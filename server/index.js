// Servidor do painel: HTTP puro, sem dependências. Roda no Termux do próprio S20.
//   /        painel (Fully Kiosk no celular)
//   /admin   configurações e telas (celular ou navegador do PC)
//   /events  SSE: empurra dados e configuração para o painel na hora
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, DATA_DIR, getConfig, setConfig, publicConfig, getSecrets, saveSecrets } from './config.js';
import * as auth from './auth.js';
import * as scheduler from './scheduler.js';
import * as updater from './updater.js';
import * as display from './display.js';
import * as claudeAuth from '../widgets/claude/auth.js';
import * as claudeCollector from '../widgets/claude/collector.js';

const DEMO = process.env.DEMO === '1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

// ---------- SSE ----------
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25_000).unref();

const fullState = () => ({ config: publicConfig(), data: scheduler.state, demo: DEMO, now: Date.now(), version: updater.status.version });

// ---------- utilidades HTTP ----------
function send(res, code, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(code, {
    'Content-Type': isJson ? MIME['.json'] : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store', ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return reject(new Error('Envie JSON.'));
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 256 * 1024) { reject(new Error('Corpo grande demais.')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('JSON inválido.')); } });
    req.on('error', reject);
  });
}

function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Não encontrado');
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(buf);
  });
}

// Só estas pastas são públicas; dos widgets, só o view.js e módulos *.shared.js (o coletor fica no servidor).
function staticPath(urlPath) {
  const p = path.posix.normalize(decodeURIComponent(urlPath));
  if (p.includes('..') || p.includes('\0')) return null;
  if (p === '/') return 'panel/index.html';
  if (p === '/admin' || p === '/admin/') return 'admin/index.html';
  if (p === '/probe') return 'panel/probe.html';
  if (p === '/manifest.webmanifest') return 'panel/manifest.webmanifest';
  if (p === '/sw.js') return 'panel/sw.js';
  if (/^\/(panel|admin)\/[\w./-]+$/.test(p)) return p.slice(1);
  if (/^\/widgets\/[\w-]+\/(view|[\w-]+\.shared)\.js$/.test(p)) return p.slice(1);
  return null;
}

// ---------- imagens e GIFs da tela de mídia (data/media) ----------
const MEDIA_DIR = path.join(DATA_DIR, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
const MEDIA_MAX = 20 * 1024 * 1024;

// Tipo pelo conteúdo, não pelo nome: só imagens.
function imageType(buf) {
  if (buf.subarray(0, 6).toString('latin1').match(/^GIF8[79]a$/)) return 'gif';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

// Lê o corpo inteiro. Passou do limite: descarta o resto, mas deixa o envio terminar,
// para o navegador receber a resposta de erro em vez de uma conexão cortada.
function readRaw(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size <= max) chunks.push(c); });
    req.on('end', () => (size > max ? reject(new Error(`Arquivo grande demais (máximo ${max / 1024 / 1024} MB).`)) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

// ---------- status dos segredos (nunca os valores) ----------
function secretsStatus() {
  const s = getSecrets();
  return {
    claudeManual: Boolean(s.claude?.accessToken),
    claudeManualHasRefresh: Boolean(s.claude?.refreshToken),
    claudeManualExpiresAt: s.claude?.expiresAt || null,
    gitToken: Boolean(s.git?.token),
  };
}

function localIps() {
  try {
    return Object.values(os.networkInterfaces()).flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  } catch { return []; } // o Android 11+ pode negar essa leitura no Termux
}

// Aceita o conteúdo do .credentials.json do Claude Code ou só o access token.
function parseClaudeCredentials(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (t.startsWith('{')) {
    let j;
    try { j = JSON.parse(t); } catch { throw new Error('O JSON colado não é válido.'); }
    const o = j.claudeAiOauth || j;
    if (!o.accessToken) throw new Error('Não achei "accessToken" no JSON colado.');
    return { accessToken: String(o.accessToken), refreshToken: o.refreshToken ? String(o.refreshToken) : null, expiresAt: Number(o.expiresAt) || null };
  }
  if (/\s/.test(t)) throw new Error('O token não pode ter espaços.');
  return { accessToken: t, refreshToken: null, expiresAt: null };
}

// ---------- rotas da API ----------
async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (p === '/api/state' && m === 'GET') return send(res, 200, fullState());

  if (p === '/api/admin/session' && m === 'GET') {
    return send(res, 200, { needsSetup: !auth.hasPassword(), logged: Boolean(auth.sessionFrom(req)) });
  }
  if (p === '/api/admin/setup' && m === 'POST') {
    if (auth.hasPassword()) return send(res, 409, { error: 'A senha já foi criada.' });
    const { password } = await readBody(req);
    auth.setPassword(password);
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieFor(auth.createSession()) });
  }
  if (p === '/api/admin/login' && m === 'POST') {
    const { password } = await readBody(req);
    if (!auth.checkPassword(password)) return send(res, 401, { error: 'Senha incorreta.' });
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieFor(auth.createSession()) });
  }

  if (!p.startsWith('/api/admin/')) return send(res, 404, { error: 'Rota desconhecida.' });
  const sid = auth.sessionFrom(req);
  if (!sid) return send(res, 401, { error: 'Entre com a senha.' });

  if (p === '/api/admin/logout' && m === 'POST') {
    auth.dropSession(sid);
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() });
  }
  if (p === '/api/admin/password' && m === 'POST') {
    const { current, next } = await readBody(req);
    if (!auth.checkPassword(current)) return send(res, 401, { error: 'Senha atual incorreta.' });
    auth.setPassword(next);
    auth.dropAllSessions();
    return send(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieFor(auth.createSession()) });
  }
  if (p === '/api/admin/config' && m === 'GET') {
    return send(res, 200, {
      config: getConfig(), secrets: secretsStatus(), status: scheduler.state, demo: DEMO, update: updater.status, display: display.status, claudeRaw: claudeCollector.lastRaw,
      server: { ips: localIps(), port: getConfig().port, uptimeSec: Math.round(process.uptime()), node: process.version },
    });
  }
  if (p === '/api/admin/config' && m === 'PUT') {
    const before = getConfig();
    const after = setConfig(await readBody(req));
    broadcast('config', publicConfig());
    display.apply(true);
    if (JSON.stringify(before.city) !== JSON.stringify(after.city)) scheduler.refresh('weather');
    if (JSON.stringify(before.claude) !== JSON.stringify(after.claude)) scheduler.refresh('claude');
    if (JSON.stringify(before.system) !== JSON.stringify(after.system)) scheduler.refresh('system');
    if (before.tela1.clockExtra !== after.tela1.clockExtra || JSON.stringify(before.quotes) !== JSON.stringify(after.quotes)) scheduler.refresh('quotes');
    return send(res, 200, { config: after, portChanged: before.port !== after.port });
  }
  if (p === '/api/admin/claude/login' && m === 'POST') {
    return send(res, 200, { url: claudeAuth.startLogin() });
  }
  if (p === '/api/admin/claude/login/finish' && m === 'POST') {
    const { code } = await readBody(req);
    await claudeAuth.finishLogin(code, { secrets: getSecrets(), saveSecrets });
    if (getConfig().claude.source !== 'manual') setConfig({ ...getConfig(), claude: { ...getConfig().claude, source: 'manual' } });
    return send(res, 200, { secrets: secretsStatus(), config: getConfig(), status: await scheduler.refresh('claude') });
  }
  if (p === '/api/admin/secrets/claude' && m === 'PUT') {
    const { credentials } = await readBody(req);
    const parsed = parseClaudeCredentials(credentials);
    const s = { ...getSecrets() };
    if (parsed) s.claude = parsed; else delete s.claude;
    saveSecrets(s);
    return send(res, 200, { secrets: secretsStatus() });
  }
  if (p.startsWith('/api/admin/collect/') && m === 'POST') {
    if (p.endsWith('/system')) (await import('../widgets/system/collector.js')).retryApi();
    const st = await scheduler.refresh(p.split('/').pop());
    return send(res, 200, st);
  }
  if (p === '/api/admin/geocode' && m === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return send(res, 400, { error: 'Digite ao menos 2 letras.' });
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=pt&format=json&name=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return send(res, 502, { error: `Busca de cidades respondeu ${r.status}.` });
    const j = await r.json();
    return send(res, 200, { results: (j.results || []).map((c) => ({
      name: c.name, region: [c.admin1, c.country].filter(Boolean).join(', '), lat: c.latitude, lon: c.longitude,
    })) });
  }
  if (p === '/api/admin/media' && m === 'POST') {
    const buf = await readRaw(req, MEDIA_MAX);
    const type = imageType(buf);
    if (!type) return send(res, 400, { error: 'Envie um GIF, PNG, JPG ou WEBP.' });
    const file = `${crypto.randomBytes(8).toString('hex')}.${type}`;
    fs.writeFileSync(path.join(MEDIA_DIR, file), buf);
    console.log(`[gif] recebido ${file} (${Math.round(buf.length / 1024)} KB)`);
    const name = decodeURIComponent(String(req.headers['x-file-name'] || file)).slice(0, 80);
    const c = getConfig();
    const after = setConfig({ ...c, gif: { ...c.gif, items: [...c.gif.items, { file, name }] } });
    broadcast('config', publicConfig());
    return send(res, 200, { config: after });
  }
  if (p.startsWith('/api/admin/media/') && m === 'DELETE') {
    const file = p.split('/').pop();
    const c = getConfig();
    if (!c.gif.items.some((i) => i.file === file)) return send(res, 404, { error: 'Imagem não encontrada.' });
    fs.rmSync(path.join(MEDIA_DIR, file), { force: true });
    const after = setConfig({ ...c, gif: { ...c.gif, items: c.gif.items.filter((i) => i.file !== file) } });
    broadcast('config', publicConfig());
    return send(res, 200, { config: after });
  }
  if (p === '/api/admin/secrets/git' && m === 'PUT') {
    const token = String((await readBody(req)).token || '').trim();
    if (token && !/^[A-Za-z0-9_]{20,255}$/.test(token)) return send(res, 400, { error: 'Isso não parece um token do GitHub (ghp_… ou github_pat_…).' });
    const s = { ...getSecrets() };
    if (token) s.git = { token }; else delete s.git;
    saveSecrets(s);
    return send(res, 200, { secrets: secretsStatus() });
  }
  if (p === '/api/admin/update/test' && m === 'POST') {
    await updater.testAccess();
    return send(res, 200, { ok: true });
  }
  if (p === '/api/admin/update' && m === 'POST') {
    const updated = await updater.check();
    return send(res, 200, { updated, update: updater.status });
  }
  if (p === '/api/admin/display/test' && m === 'POST') {
    await display.test();
    return send(res, 200, { display: display.status });
  }
  if (p === '/api/admin/reload-panel' && m === 'POST') {
    broadcast('reload', {});
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'Rota desconhecida.' });
}

// ---------- servidor ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`retry: 3000\nevent: state\ndata: ${JSON.stringify(fullState())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método não permitido');
    const media = /^\/media\/([a-f0-9]{16}\.(gif|png|jpg|webp))$/.exec(url.pathname);
    if (media) {
      return fs.readFile(path.join(MEDIA_DIR, media[1]), (err, buf) => {
        if (err) return send(res, 404, 'Não encontrado');
        res.writeHead(200, { 'Content-Type': MIME[`.${media[2]}`], 'Cache-Control': 'public, max-age=31536000, immutable' });
        res.end(buf);
      });
    }
    const rel = staticPath(url.pathname);
    if (!rel) return send(res, 404, 'Não encontrado');
    serveFile(res, path.join(ROOT, rel));
  } catch (e) {
    if (!res.headersSent) send(res, 400, { error: String(e.message || e) });
    else res.end();
  }
});

await updater.init();
updater.start();
display.start();
await scheduler.loadCollectors();
scheduler.start((id, st) => broadcast('data', { id, state: st }));

const port = Number(process.env.PORT) || getConfig().port;
server.listen(port, '0.0.0.0', () => {
  const ips = localIps();
  console.log(`Versão ${updater.status.version}. Painel em http://localhost:${port}/  ·  admin em /admin${DEMO ? '  ·  MODO DEMO (dados de exemplo)' : ''}`);
  for (const ip of ips) console.log(`  na rede: http://${ip}:${port}/admin`);
});

process.on('unhandledRejection', (e) => console.error('rejeição não tratada:', e));
process.on('uncaughtException', (e) => console.error('exceção não tratada:', e));
