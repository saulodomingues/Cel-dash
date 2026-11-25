// Token OAuth da assinatura Claude.
// Duas origens: o arquivo de credenciais do Claude Code (padrão ~/.claude/.credentials.json,
// criado ao fazer login no Claude Code dentro do Termux) ou credenciais coladas no /admin.
// Nada disto é API documentada; pode mudar sem aviso.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1e250a-e61b-44d9-88ed-5944d1962f5e'; // cliente OAuth do Claude Code, o emissor do token

const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPE = 'user:profile'; // só o necessário para ler o uso; não dá acesso a conversar com os modelos

// ---------- login pelo /admin (mesmo fluxo do `claude login`: abre o claude.ai, devolve um código) ----------
const b64url = (buf) => buf.toString('base64url');
export const challengeFor = (verifier) => b64url(crypto.createHash('sha256').update(verifier).digest());
let pending = null; // { verifier, state, at }

export function startLogin() {
  pending = { verifier: b64url(crypto.randomBytes(32)), state: b64url(crypto.randomBytes(32)), at: Date.now() };
  const q = new URLSearchParams({
    code: 'true', client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI, scope: SCOPE,
    code_challenge: challengeFor(pending.verifier), code_challenge_method: 'S256', state: pending.state,
  });
  return `${AUTHORIZE_URL}?${q}`;
}

// `pasted` é o que a página do Claude mostra para copiar: "codigo#state".
export async function finishLogin(pasted, { secrets, saveSecrets }) {
  if (!pending || Date.now() - pending.at > 15 * 60_000) throw new Error('O login expirou. Clique em "Entrar com a conta Claude" de novo.');
  const [code, state] = String(pasted || '').trim().split('#');
  if (!code) throw new Error('Cole o código que a página do Claude mostrou.');
  if (state && state !== pending.state) throw new Error('Esse código é de outra tentativa de login. Comece de novo.');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, state: pending.state, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, code_verifier: pending.verifier }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => { throw new Error('O celular não conseguiu falar com o servidor do Claude. Confira a internet e tente de novo.'); });
  if (!r.ok) throw new Error(`O Claude recusou o código (${r.status}). Confira se copiou inteiro e tente de novo.`);
  const j = await r.json();
  if (!j.access_token) throw new Error('A resposta do login veio sem token.');
  pending = null;
  saveSecrets({ ...secrets, claude: { accessToken: j.access_token, refreshToken: j.refresh_token || null, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 } });
}

const expand = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function readFileCreds(file) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    throw new Error(e.code === 'ENOENT'
      ? `Credenciais não encontradas em ${file}. Entre com a conta Claude pelo /admin.`
      : `Não consegui ler ${file}: ${e.message}`);
  }
  const o = j.claudeAiOauth;
  if (!o?.accessToken) throw new Error(`${file} não tem claudeAiOauth.accessToken.`);
  return { raw: j, creds: { accessToken: o.accessToken, refreshToken: o.refreshToken || null, expiresAt: o.expiresAt || null } };
}

export function load({ config, secrets }) {
  if (config.claude.source === 'manual') {
    if (!secrets.claude?.accessToken) throw new Error('Conta Claude não conectada. Entre pelo /admin.');
    return { where: 'manual', creds: secrets.claude };
  }
  const file = expand(config.claude.credentialsFile);
  return { where: 'file', file, ...readFileCreds(file) };
}

function save(src, creds, { secrets, saveSecrets }) {
  if (src.where === 'manual') return saveSecrets({ ...secrets, claude: creds });
  // regrava no mesmo formato, para o Claude Code do aparelho continuar logado
  const raw = { ...src.raw, claudeAiOauth: { ...src.raw.claudeAiOauth, ...creds } };
  const tmp = `${src.file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(raw), { mode: 0o600 });
  fs.renameSync(tmp, src.file);
}

export async function refresh(src, ctx) {
  if (!src.creds.refreshToken) throw new Error('Login do Claude expirado. Entre de novo pelo /admin.');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: src.creds.refreshToken, client_id: CLIENT_ID }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Renovação do token falhou (${r.status}). Entre de novo com a conta Claude pelo /admin.`);
  const j = await r.json();
  const creds = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || src.creds.refreshToken,
    expiresAt: Date.now() + (j.expires_in || 3600) * 1000,
  };
  save(src, creds, ctx);
  return creds;
}

// Devolve um access token válido, renovando se faltar menos de 5 min.
export async function getToken(ctx, force = false) {
  const src = load(ctx);
  const soon = src.creds.expiresAt && src.creds.expiresAt - Date.now() < 5 * 60_000;
  if ((force || soon) && src.creds.refreshToken) return (await refresh(src, ctx)).accessToken;
  return src.creds.accessToken;
}
