// Brilho da tela pelo próprio Termux (Termux:API, `termux-brightness`), para funcionar no
// Chrome, sem o Fully Kiosk. Brilho de dia ou de noite pelo horário; no horário de tela
// apagada, o mínimo (o painel fica preto, e no AMOLED pixel preto fica desligado).
// Precisa da permissão "Modificar configurações do sistema" para o app Termux:API.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
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
      if (err.code === 'ENOENT') return reject(new Error('termux-brightness não encontrado: rode "pkg install termux-api" no Termux.'));
      // sem resposta: em geral o app Termux:API não está instalado, ou veio de outra loja que não a do Termux
      if (err.killed || err.signal) return reject(new Error('o app Termux:API não respondeu. Confira se ele está instalado e se veio da mesma loja do Termux (F-Droid ou GitHub).'));
      reject(new Error((stderr || err.message).trim().split('\n').pop() || 'falhou'));
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

// No aparelho: Node do Termux. Não depende de variáveis de ambiente (o Termux:Boot pode não passar todas).
export const inTermux = () => process.execPath.includes('com.termux') || fs.existsSync('/data/data/com.termux/files/usr/bin/termux-brightness');

// Teste pelo /admin: brilho máximo por 3 s e volta ao do horário.
export async function test() {
  if (!inTermux()) throw new Error('Só funciona no celular, com o servidor rodando no Termux.');
  await run(255);
  setTimeout(() => apply(true), 3000);
  Object.assign(status, { error: null, at: Date.now() });
}

export function start() {
  // só no aparelho: fora do Termux o comando não existe e não há tela para ajustar
  if (!inTermux()) { status.error = 'Só funciona no celular, com o servidor rodando no Termux.'; return; }
  apply(true);
  setInterval(() => apply(), 60_000).unref();
}
