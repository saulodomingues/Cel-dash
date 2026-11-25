// Token OAuth da assinatura Claude.
// Duas origens: o arquivo de credenciais do Claude Code (padrão ~/.claude/.credentials.json,
// criado ao fazer login no Claude Code dentro do Termux) ou credenciais coladas no /admin.
// Nada disto é API documentada; pode mudar sem aviso.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1e250a-e61b-44d9-88ed-5944d1962f5e'; // cliente OAuth do Claude Code, o emissor do token

const expand = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

function readFileCreds(file) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    throw new Error(e.code === 'ENOENT'
      ? `Credenciais não encontradas em ${file}. Faça login no Claude Code no Termux ou cole as credenciais no /admin.`
      : `Não consegui ler ${file}: ${e.message}`);
  }
  const o = j.claudeAiOauth;
  if (!o?.accessToken) throw new Error(`${file} não tem claudeAiOauth.accessToken.`);
  return { raw: j, creds: { accessToken: o.accessToken, refreshToken: o.refreshToken || null, expiresAt: o.expiresAt || null } };
}

export function load({ config, secrets }) {
  if (config.claude.source === 'manual') {
    if (!secrets.claude?.accessToken) throw new Error('Nenhuma credencial do Claude salva. Cole no /admin.');
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
  if (!src.creds.refreshToken) throw new Error('Token expirado e sem refresh token. Refaça o login ou cole credenciais novas.');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: src.creds.refreshToken, client_id: CLIENT_ID }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Renovação do token falhou (${r.status}). Refaça o login do Claude.`);
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
