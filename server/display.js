// Brilho da tela pelo próprio Termux (Termux:API, `termux-brightness`), para funcionar no
// Chrome, sem o Fully Kiosk. Brilho de dia ou de noite pelo horário; no horário de tela
// apagada, o mínimo (o painel fica preto, e no AMOLED pixel preto fica desligado).
// Precisa da permissão "Modificar configurações do sistema" para o app Termux:API.
import { execFile } from 'node:child_process';
import { getConfig } from './config.js';
import { inRange } from '../panel/burnin.js';

export const status = { level: null, at: null, error: null, enabled: false };

export function target(now, cfg) {
  if (cfg.sleep.enabled && inRange(now, cfg.sleep.start, cfg.sleep.end)) return 0;
  const pct = inRange(now, cfg.night.start, cfg.night.end) ? cfg.brightness.night : cfg.brightness.day;
  return Math.max(1, Math.round((pct / 100) * 255));
}

function run(level) {
  return new Promise((resolve, reject) => {
    execFile('termux-brightness', [String(level)], { timeout: 10_000 }, (err, _out, stderr) => {
      if (!err) return resolve();
      reject(new Error(err.code === 'ENOENT'
        ? 'termux-brightness não encontrado (instale o Termux:API).'
        : (stderr || err.message).trim().split('\n').pop() || 'falhou'));
    });
  });
}

export async function apply(force = false) {
  const cfg = getConfig();
  status.enabled = cfg.display.browser === 'chrome'; // no Fully, quem ajusta o brilho é ele
  if (!status.enabled) { status.level = null; status.error = null; return; }
  const level = target(Date.now(), cfg);
  if (!force && level === status.level && !status.error) return;
  try {
    await run(level);
    Object.assign(status, { level, at: Date.now(), error: null });
  } catch (e) {
    Object.assign(status, { level: null, at: Date.now(), error: e.message });
  }
}

export function start() {
  // só no aparelho: fora do Termux o comando não existe e não há tela para ajustar
  if (!process.env.PREFIX?.includes('com.termux')) { status.error = 'Só funciona no Termux.'; return; }
  apply(true);
  setInterval(() => apply(), 60_000).unref();
}
