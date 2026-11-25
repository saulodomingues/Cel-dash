// Cor com significado: tons que mudam com a hora do dia, o tempo lá fora e o ritmo de uso do Claude.
// Fundos sempre muito escuros (o AMOLED quase não acende); a cor forte fica só nos alertas.
import { WD } from './lib.js';

export const ORANGE = '#FB8C3C', RED = '#F87171';

// ---------- hora do dia ----------
// 'day' entre o nascer e o pôr do sol (pelos dados do tempo; sem eles, 6h às 18h), 'night' fora disso.
export function phase(now, weather) {
  const sun = weather?.data?.sun;
  const today = (arr) => arr?.find((t) => new Date(t).toDateString() === new Date(now).toDateString());
  const rise = today(sun?.rises), set = today(sun?.sets);
  if (rise && set) return now >= rise && now < set ? 'day' : 'night';
  const h = new Date(now).getHours();
  return h >= 6 && h < 18 ? 'day' : 'night';
}

const CLOCK = {
  day: { bg: 'radial-gradient(120% 140% at 0% 0%, #22160A 0%, #0D0B09 55%)', border: '#33230F', digits: '#F0C98A' },
  night: { bg: 'radial-gradient(120% 140% at 0% 0%, #0F1428 0%, #09090F 55%)', border: '#1C2440', digits: '#B9C6E4' },
};
export const clockMood = (now, weather) => CLOCK[phase(now, weather)];

// ---------- tempo ----------
const SKY = {
  rain: { glow: '#0B1B33', base: '#080B12', border: '#173052', chip: 'rgba(138,180,248,0.08)' },
  storm: { glow: '#151033', base: '#09080F', border: '#2A2052', chip: 'rgba(170,150,248,0.09)' },
  sun: { glow: '#2A1A06', base: '#0E0B07', border: '#3D2A0E', chip: 'rgba(245,165,36,0.08)' },
  partly: { glow: '#1E160B', base: '#0C0B0A', border: '#30261A', chip: 'rgba(245,165,36,0.06)' },
  moon: { glow: '#10132A', base: '#08080E', border: '#1E2342', chip: 'rgba(160,170,240,0.07)' },
  'partly-night': { glow: '#10132A', base: '#08080E', border: '#1E2342', chip: 'rgba(160,170,240,0.07)' },
  cloud: { glow: '#15181E', base: '#0B0C0E', border: '#252930', chip: 'rgba(196,199,204,0.06)' },
  fog: { glow: '#15181E', base: '#0B0C0E', border: '#252930', chip: 'rgba(196,199,204,0.06)' },
  snow: { glow: '#0E1C24', base: '#090C0E', border: '#1B3340', chip: 'rgba(170,220,240,0.08)' },
};
export function skyMood(icon) {
  const s = SKY[icon] || SKY.cloud;
  return { bg: `radial-gradient(120% 140% at 100% 0%, ${s.glow} 0%, ${s.base} 60%)`, border: s.border, chip: s.chip };
}

// ---------- ritmo de uso ----------
// Projeção linear desde o início da janela. Só vale depois de 10% da janela, para não alarmar
// com poucos minutos de dado. Devolve a hora em que o limite acaba, se for antes da renovação.
export function runOut(win, windowMs, now) {
  if (!win || typeof win.pct !== 'number' || !win.resetsAt || win.pct <= 0) return null;
  const start = win.resetsAt - windowMs;
  const elapsed = now - start;
  if (elapsed < windowMs * 0.1 || win.resetsAt <= now) return null;
  const t = start + (elapsed * 100) / win.pct;
  return t < win.resetsAt ? Math.max(t, now) : null;
}

// Curto, para caber embaixo do anel: "acaba qui 17h", "acaba hoje 22h".
const when = (t, now) => {
  const d = new Date(t);
  const day = d.toDateString() === new Date(now).toDateString() ? 'hoje' : WD[d.getDay()];
  return `${day} ${d.getHours()}h`;
};

// Cor do anel/barra e o aviso: vermelho no limite ou crítico; laranja se o ritmo estoura antes de renovar.
export function usageMood(win, base, windowMs, now) {
  if (!win || typeof win.pct !== 'number') return { color: base, note: null };
  if (win.pct >= 100) return { color: RED, note: 'limite atingido' };
  if (win.pct >= 90 || win.severity === 'critical') return { color: RED, note: null };
  const out = runOut(win, windowMs, now);
  if (out) return { color: ORANGE, note: `acaba ${when(out, now)}` };
  if (win.pct >= 75 || win.severity === 'warning') return { color: ORANGE, note: null };
  return { color: base, note: null };
}

export const SESSION_MS = 5 * 3600_000, WEEK_MS = 7 * 86400_000;
