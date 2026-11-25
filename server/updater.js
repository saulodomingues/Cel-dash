// Atualização automática: o servidor consulta o GitHub de tempos em tempos e, se houver
// versão nova, faz `git pull` e encerra; o laço de scripts/run.sh o sobe de novo já atualizado.
// Só fica ativo quando o servidor roda por esse laço (SUPERVISED=1), para nunca derrubar
// um `npm start` feito à mão no PC.
import { execFile } from 'node:child_process';
import { ROOT, getConfig } from './config.js';

const git = (...args) => new Promise((resolve, reject) => {
  // GIT_TERMINAL_PROMPT=0: sem credencial salva, falha na hora em vez de ficar esperando digitação
  execFile('git', ['-C', ROOT, ...args], { timeout: 90_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) => {
    if (!err) return resolve(stdout.trim());
    reject(new Error(err.code === 'ENOENT' ? 'git não está instalado' : (stderr || err.message).trim().split('\n').pop()));
  });
});

export const supervised = process.env.SUPERVISED === '1';
export const status = { version: 'dev', date: null, branch: null, checkedAt: null, error: null, supervised };
let busy = false;

export async function init() {
  try {
    status.version = await git('rev-parse', '--short', 'HEAD');
    status.date = Number(await git('log', '-1', '--format=%ct')) * 1000;
    status.branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
  } catch { /* pasta sem git: fica "dev" e sem atualização */ }
}

// Devolve true se baixou versão nova (e agenda o reinício).
export async function check() {
  if (!supervised) throw new Error('Atualização automática só funciona com o servidor iniciado pelo scripts/run.sh.');
  if (busy) return false;
  busy = true;
  try {
    const before = await git('rev-parse', 'HEAD');
    await git('pull', '--ff-only', '--quiet');
    const after = await git('rev-parse', 'HEAD');
    status.checkedAt = Date.now(); status.error = null;
    if (before === after) return false;
    console.log(`Atualizado de ${before.slice(0, 7)} para ${after.slice(0, 7)}; reiniciando.`);
    setTimeout(() => process.exit(0), 800); // tempo de responder ao /admin antes de sair
    return true;
  } catch (e) {
    status.checkedAt = Date.now(); status.error = e.message;
    throw e;
  } finally { busy = false; }
}

export function start() {
  if (!supervised) return;
  let last = Date.now() - 3600_000 * 24; // confere logo ao subir
  setInterval(() => {
    const u = getConfig().update;
    if (!u.enabled || Date.now() - last < u.intervalMin * 60_000) return;
    last = Date.now();
    check().catch((e) => console.error('[atualização]', e.message));
  }, 20_000).unref();
}
