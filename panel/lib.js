// Utilidades de formatação compartilhadas pelos componentes do painel.
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const pad = (n) => String(n).padStart(2, '0');
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WD_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const dateLong = (t) => { const d = new Date(t); return `${WD_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
export const dateShort = (t) => { const d = new Date(t); return `${WD[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
export const num = (v, digits = 0) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—');
export const deg = (v) => (typeof v === 'number' ? `${Math.round(v)}°` : '—');
export const pct = (v) => (typeof v === 'number' ? `${Math.round(v)}%` : '—');

// "1 h 41" (curto) ou "5 h 32 min" (longo)
export function dur(ms, long = false) {
  const m = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  if (h === 0) return `${m} min`;
  return long ? `${h} h ${m % 60} min` : `${h} h ${pad(m % 60)}`;
}

// Texto do canto do card: idade da última coleta boa.
export function ago(w, now) {
  if (!w?.at) return 'sem dados';
  const m = Math.floor((now - w.at) / 60_000);
  const age = m < 1 ? 'atualizado agora' : m < 60 ? `atualizado há ${m} min` : `atualizado há ${Math.floor(m / 60)} h`;
  return w.error ? `sem conexão · ${age.replace('atualizado ', '')}` : age;
}

export function resetText(resetsAt, now) {
  if (!resetsAt) return 'sem janela ativa';
  const left = resetsAt - now;
  if (left <= 0) return 'renovando';
  if (left < 24 * 3600_000) return `renova em ${dur(left)}`;
  return `renova ${WD[new Date(resetsAt).getDay()]} ${hm(resetsAt)}`;
}

export const noData = (msg = 'sem dados') => `<div style="flex: 1; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #9AA0A6">${esc(msg)}</div>`;

export const SG = "font-family: 'Space Grotesk', sans-serif";
export const LABEL = 'font-size: 11px; color: #9AA0A6; letter-spacing: 0.04em';
