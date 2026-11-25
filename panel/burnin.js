// Proteção do AMOLED: pixel shift, brilho por horário, tela ociosa e tela apagada.
// Com display.browser = 'fully': brilho, apagar/acender e detecção de movimento pela interface
// JavaScript do Fully Kiosk (objeto `fully`). Com 'chrome' (padrão): o brilho vem do servidor
// (termux-brightness), o horário de apagar deixa o painel preto e não há tela ociosa.
const F = () => (typeof window.fully !== 'undefined' ? window.fully : null);
export const hasFully = () => Boolean(F());

const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export function inRange(now, start, end) {
  const d = new Date(now), cur = d.getHours() * 60 + d.getMinutes();
  const a = mins(start), b = mins(end);
  return a === b ? false : a < b ? cur >= a && cur < b : cur >= a || cur < b;
}

// Deslocamento do painel inteiro: percorre uma espiral dentro de ±maxPx.
export function shiftOffset(now, cfg) {
  const n = cfg.maxPx;
  if (!n) return [0, 0];
  const side = 2 * n + 1;
  const k = Math.floor(now / (cfg.intervalSec * 1000)) % (side * side);
  // espiral quadrada a partir do centro
  let x = 0, y = 0, dx = 1, dy = 0, len = 1, walked = 0, turns = 0;
  for (let i = 0; i < k; i++) {
    x += dx; y += dy;
    if (++walked === len) { walked = 0; [dx, dy] = [-dy, dx]; if (++turns % 2 === 0) len++; }
  }
  return [x, y];
}

let lastActivity = Date.now();
let wakeUntil = 0;
let motionSeen = false;
let lastBrightness = null;
let lastMode = 'on';

export function activity(fromMotion = false) {
  lastActivity = Date.now();
  if (fromMotion) motionSeen = true;
}
// Toque durante o horário de tela apagada: acende por 2 minutos.
export function wakeBriefly() { wakeUntil = Date.now() + 120_000; activity(); }

export function bindFully() {
  const f = F();
  if (!f) return;
  window.__s20motion = () => activity(true);
  window.__s20screenOn = () => activity();
  try {
    f.bind('onMotion', '__s20motion();');
    f.bind('screenOn', '__s20screenOn();');
  } catch { /* versões antigas do Fully */ }
}

// 'on' | 'idle' | 'off'
export function mode(now, cfg) {
  const fully = cfg.display?.browser === 'fully';
  if (now < wakeUntil) return 'on';
  if (cfg.sleep.enabled && inRange(now, cfg.sleep.start, cfg.sleep.end)) return 'off';
  // sem detecção de movimento não dá para saber se há alguém: nunca entra em ocioso sozinho
  if (fully && cfg.idle.enabled && motionSeen) {
    const quiet = (now - lastActivity) / 60_000;
    if (cfg.idle.offAfterMin > 0 && quiet >= cfg.idle.afterMin + cfg.idle.offAfterMin) return 'off';
    if (quiet >= cfg.idle.afterMin) return 'idle';
  }
  return 'on';
}

export function apply(now, cfg, m) {
  const f = F();
  if (!f) return;
  try {
    const pct = inRange(now, cfg.night.start, cfg.night.end) ? cfg.brightness.night : cfg.brightness.day;
    const v = Math.max(1, Math.round((pct / 100) * 255));
    if (v !== lastBrightness && m !== 'off') { f.setScreenBrightness(v); lastBrightness = v; }
    if (m !== lastMode) {
      if (m === 'off') f.turnScreenOff();
      else if (lastMode === 'off') { f.turnScreenOn(); lastBrightness = null; }
      lastMode = m;
    }
  } catch { /* nunca derruba o painel */ }
}
