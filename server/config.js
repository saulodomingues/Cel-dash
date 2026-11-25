// Configuração (data/config.json) e segredos (data/secrets.json).
// Os segredos nunca saem do servidor: nenhuma rota devolve o conteúdo deste arquivo.
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG, MAX_QUOTES } from '../widgets/quotes/catalog.shared.js';
import { FEEDS } from '../widgets/news/catalog.shared.js';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');

export const DEFAULTS = {
  port: 8080,
  city: { name: 'São Paulo', lat: -23.5475, lon: -46.6361 },
  screens: [
    // seconds: quanto tempo a tela fica (null = o geral, rotation.intervalSec); auto (só manchetes):
    // fica o tempo de mostrar todas as manchetes uma vez
    { id: 'tela1', enabled: true, seconds: 180 },
    { id: 'tela2', enabled: true, seconds: 60 },
    { id: 'tela3', enabled: true, seconds: 45 },
    { id: 'news', enabled: true, seconds: null, auto: true }, // manchetes: só entra na rotação se houver manchetes
    { id: 'gif', enabled: false, seconds: 30 }, // tela cheia de GIF: desligada por padrão; só entra na rotação se houver imagem
  ],
  gif: { items: [], fit: 'contain', full: '*' }, // items: [{ file, name }] em data/media; full: GIF da tela cheia ('*' = alterna)
  tela1: { clockExtra: 'calendar', clockGif: '*' }, // clockExtra: 'calendar' | 'quotes' | 'gif' | 'none'; clockGif: arquivo em data/media ou '*' = alterna entre todos
  // contadores do Claude nas telas 1 e 2: quais e em que ordem; estatística de 7 dias na tela 1
  claudeView: {
    counters: [{ id: 'session', enabled: true }, { id: 'model', enabled: true }, { id: 'week', enabled: true }],
    showStats: true,
    hideUnlimited: true,
    gif: '', // GIF à direita do card do Claude: '' = nenhum, '*' = alterna entre todos, ou um arquivo
  },
  rotation: { intervalSec: 180, tapNext: true },
  pixelShift: { intervalSec: 60, maxPx: 4 },
  brightness: { day: 35, night: 8 },
  // navegador do painel no celular: 'chrome' (brilho pelo Termux, tela preta no horário de apagar)
  // ou 'fully' (Fully Kiosk: brilho, apagar a tela e detecção de movimento pela interface dele)
  display: { browser: 'chrome' },
  night: { start: '22:00', end: '07:00' },
  sleep: { enabled: false, start: '00:30', end: '06:30' },
  idle: { enabled: true, afterMin: 10, offAfterMin: 20 },
  update: { enabled: true, intervalMin: 5 },
  weather: { intervalMin: 15 },
  // manchetes: fontes do catálogo (widgets/news/catalog.shared.js) + endereços de feed colados
  news: { feeds: ['g1', 'folha', 'bbc', 'agbrasil', 'tecnoblog'], custom: [], ticker: true, seconds: 12, crawl: 'normal', intervalMin: 10, maxAgeHours: 12, blockWords: [], maxItems: 20 },
  quotes: { items: ['USD', 'EUR', 'BTC', 'ETH', 'IBOV', 'SPX'], intervalMin: 5 }, // ids de widgets/quotes/catalog.shared.js, até 6
  claude: {
    intervalMin: 10,
    source: 'manual', // 'manual' = login feito no /admin (ou credenciais coladas); 'file' = arquivo do Claude Code
    credentialsFile: '~/.claude/.credentials.json',
    modelKey: 'auto',
    planLabel: 'assinatura Max',
  },
  system: {
    intervalSec: 60,
    chargeLimit: 85,
    pingHost: '1.1.1.1',
    pingPort: 443,
    vpn: { label: 'VPN no Pi', host: '', port: 22 },
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Mescla `over` em `base` mantendo só chaves conhecidas e o tipo do padrão.
function merge(base, over) {
  if (!isObj(base)) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    if (typeof base === 'number') { const n = Number(over); return Number.isFinite(n) ? n : base; }
    if (typeof base === 'boolean') return over === true || over === 'true';
    return String(over);
  }
  const out = {};
  for (const k of Object.keys(base)) out[k] = merge(base[k], isObj(over) ? over[k] : undefined);
  return out;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const hhmm = (s, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : d);

// Tempo por tela: sem o campo (config antiga), usa o padrão daquela tela; null usa o tempo geral.
function screenCfg(s) {
  const d = DEFAULTS.screens.find((x) => x.id === s.id);
  const raw = s.seconds === undefined ? d.seconds : s.seconds;
  const n = Number(raw);
  const out = { id: s.id, enabled: s.enabled !== false, seconds: raw === null || raw === '' || !Number.isFinite(n) ? null : clamp(Math.round(n), 10, 3600) };
  if (s.id === 'news') out.auto = s.auto === undefined ? d.auto : s.auto === true;
  return out;
}

function sanitize(c) {
  const known = DEFAULTS.screens.map((s) => s.id);
  const seen = new Set();
  const screens = [];
  for (const s of c.screens) {
    if (!s || !known.includes(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    screens.push(screenCfg(s));
  }
  for (const id of known) if (!seen.has(id)) screens.push({ ...DEFAULTS.screens.find((d) => d.id === id) });
  c.screens = screens;
  const ids = ['session', 'model', 'week'], got = [];
  for (const x of c.claudeView.counters) if (x && ids.includes(x.id) && !got.some((g) => g.id === x.id)) got.push({ id: x.id, enabled: x.enabled !== false });
  for (const id of ids) if (!got.some((g) => g.id === id)) got.push({ id, enabled: true });
  if (!got.some((g) => g.enabled) && !c.claudeView.showStats) c.claudeView.showStats = true; // card nunca vazio
  c.claudeView.counters = got;
  if (c.claudeView.gif !== '*' && !c.gif.items.some((i) => i.file === c.claudeView.gif)) c.claudeView.gif = '';
  c.quotes.items = [...new Set(c.quotes.items.filter((id) => CATALOG.some((q) => q.id === id)))].slice(0, MAX_QUOTES);
  c.quotes.intervalMin = clamp(Math.round(c.quotes.intervalMin), 2, 120);
  c.news.feeds = [...new Set(c.news.feeds.filter((id) => FEEDS.some((f) => f.id === id)))];
  c.news.custom = [...new Set(c.news.custom.map((u) => String(u).trim()).filter((u) => /^https?:\/\/[^\s]+$/.test(u)))].slice(0, 10);
  c.news.seconds = clamp(Math.round(c.news.seconds), 5, 60);
  c.news.crawl = ['lenta', 'normal', 'rapida'].includes(c.news.crawl) ? c.news.crawl : 'normal';
  c.news.intervalMin = clamp(Math.round(c.news.intervalMin), 5, 120);
  c.news.maxAgeHours = clamp(Math.round(c.news.maxAgeHours), 1, 72);
  c.news.blockWords = c.news.blockWords.map((w) => String(w).trim()).filter(Boolean).slice(0, 30);
  c.news.maxItems = clamp(Math.round(c.news.maxItems), 3, 40);
  c.display.browser = c.display.browser === 'fully' ? 'fully' : 'chrome';
  c.gif.fit = c.gif.fit === 'cover' ? 'cover' : 'contain';
  c.gif.items = c.gif.items.filter((i) => i && /^[a-f0-9]{16}\.(gif|png|jpg|webp)$/.test(i.file)).map((i) => ({ file: i.file, name: String(i.name || i.file).slice(0, 80) }));
  if (c.gif.full !== '*' && !c.gif.items.some((i) => i.file === c.gif.full)) c.gif.full = '*';
  c.tela1.clockExtra = ['calendar', 'quotes', 'gif', 'none'].includes(c.tela1.clockExtra) ? c.tela1.clockExtra : 'calendar';
  if (c.tela1.clockGif !== '*' && !c.gif.items.some((i) => i.file === c.tela1.clockGif)) c.tela1.clockGif = '*';
  c.port = clamp(Math.round(c.port), 1024, 65535);
  c.city.lat = clamp(c.city.lat, -90, 90);
  c.city.lon = clamp(c.city.lon, -180, 180);
  c.rotation.intervalSec = clamp(Math.round(c.rotation.intervalSec), 20, 3600);
  c.pixelShift.intervalSec = clamp(Math.round(c.pixelShift.intervalSec), 10, 3600);
  c.pixelShift.maxPx = clamp(Math.round(c.pixelShift.maxPx), 0, 8);
  c.brightness.day = clamp(Math.round(c.brightness.day), 1, 100);
  c.brightness.night = clamp(Math.round(c.brightness.night), 1, 100);
  for (const k of ['night', 'sleep']) {
    c[k].start = hhmm(c[k].start, DEFAULTS[k].start);
    c[k].end = hhmm(c[k].end, DEFAULTS[k].end);
  }
  c.idle.afterMin = clamp(c.idle.afterMin, 1, 720);
  c.idle.offAfterMin = clamp(c.idle.offAfterMin, 0, 720);
  c.update.intervalMin = clamp(Math.round(c.update.intervalMin), 1, 1440);
  c.weather.intervalMin = clamp(c.weather.intervalMin, 5, 180);
  c.claude.intervalMin = clamp(c.claude.intervalMin, 5, 180); // coleta espaçada: endpoint não documentado
  c.claude.source = c.claude.source === 'file' ? 'file' : 'manual';
  c.system.intervalSec = clamp(Math.round(c.system.intervalSec), 30, 600);
  c.system.chargeLimit = clamp(Math.round(c.system.chargeLimit), 0, 100);
  c.system.pingPort = clamp(Math.round(c.system.pingPort), 1, 65535);
  c.system.vpn.port = clamp(Math.round(c.system.vpn.port), 1, 65535);
  return c;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJsonAtomic(file, obj, mode = 0o600) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), { mode });
  fs.renameSync(tmp, file);
}

let config = sanitize(merge(DEFAULTS, readJson(CONFIG_FILE, {})));
let secrets = readJson(SECRETS_FILE, {});

export const getConfig = () => config;
export function setConfig(patch) {
  config = sanitize(merge(DEFAULTS, patch));
  writeJsonAtomic(CONFIG_FILE, config, 0o644);
  return config;
}

export const getSecrets = () => secrets;
export function saveSecrets(next) {
  secrets = next;
  writeJsonAtomic(SECRETS_FILE, secrets, 0o600);
}

// O que o painel pode ver: tudo menos caminhos de arquivo do servidor.
export function publicConfig() {
  const c = structuredClone(config);
  delete c.claude.credentialsFile;
  delete c.claude.source;
  return c;
}
