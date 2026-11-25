// Uso da assinatura Claude: sessão de 5 h, semana de um modelo (Fable) e semana geral.
// Endpoint não documentado, o mesmo que o /usage do Claude Code consulta.
// Cada leitura vai para o histórico local; dele saem as barras de 7 dias e a curva da sessão.
import { getToken } from './auth.js';

export const id = 'claude';
export const intervalMs = (cfg) => cfg.claude.intervalMin * 60_000;
export const minRetryMs = 5 * 60_000; // endpoint não documentado: nunca insistir rápido

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const SESSION_MS = 5 * 3600_000;

async function request(token) {
  return fetch(USAGE_URL, {
    headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', Accept: 'application/json', 'User-Agent': 'monitor-mesa-s22/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
}

export async function fetchUsage(ctx) {
  let r = await request(await getToken(ctx));
  if (r.status === 401) r = await request(await getToken(ctx, true)); // token vencido: renova e tenta uma vez
  if (r.status === 429) {
    const e = new Error('Limite de consultas do endpoint de uso (429). Vou espaçar as tentativas.');
    e.retryAfterMs = (Number(r.headers.get('retry-after')) || 0) * 1000;
    throw e;
  }
  if (!r.ok) throw new Error(`Endpoint de uso respondeu ${r.status}`);
  return r.json();
}

const win = (o) => (o && typeof o.utilization === 'number'
  ? { pct: o.utilization, resetsAt: o.resets_at ? Date.parse(o.resets_at) : null }
  : null);

const LABELS = { fable: 'Fable', opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

// Chaves "seven_day_<modelo>" que a resposta traz (limites semanais por modelo).
export function modelKeys(raw) {
  return Object.keys(raw).filter((k) => /^seven_day_[a-z0-9_]+$/.test(k) && k !== 'seven_day_oauth_apps');
}

export function normalize(raw, modelKey = 'auto') {
  const keys = modelKeys(raw);
  let key = null;
  if (modelKey !== 'auto' && modelKey) key = keys.includes(modelKey) ? modelKey : null;
  else key = ['seven_day_fable', ...keys].find((k) => keys.includes(k) && win(raw[k])) || null;
  const short = key ? key.replace('seven_day_', '') : null;
  return {
    session: win(raw.five_hour),
    week: win(raw.seven_day),
    model: key && win(raw[key]) ? { ...win(raw[key]), key, label: LABELS[short] || short } : null,
    keys,
  };
}

// Barras: quanto do limite semanal foi gasto em cada um dos últimos 7 dias.
export function dailyUse(readings, now) {
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => ({ t: mid.getTime() - (6 - i) * 86400_000, value: 0 }));
  let prev = null;
  for (const r of readings) {
    if (typeof r.w !== 'number') continue;
    const delta = prev === null ? 0 : r.w >= prev ? r.w - prev : r.w; // queda = a semana renovou
    prev = r.w;
    const d = days.findLast((x) => r.t >= x.t);
    if (d && r.t < d.t + 86400_000) d.value += delta;
  }
  return days.map((d) => ({ t: d.t, value: Math.round(d.value * 10) / 10 }));
}

// Curva: leituras da sessão atual (mesmo horário de renovação), no máximo ~60 pontos.
export function sessionCurve(readings, session) {
  if (!session?.resetsAt) return [];
  const start = session.resetsAt - SESSION_MS;
  const pts = readings
    .filter((r) => typeof r.s === 'number' && r.t >= start && Math.abs((r.sr || 0) - session.resetsAt) < 5 * 60_000)
    .map((r) => ({ t: r.t, pct: r.s }));
  const step = Math.ceil(pts.length / 60) || 1;
  return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
}

export async function collect(ctx) {
  const now = Date.now();
  const n = normalize(await fetchUsage(ctx), ctx.config.claude.modelKey);
  if (!n.session && !n.week) throw new Error('A resposta de uso veio sem five_hour e sem seven_day.');
  ctx.history.append('claude', { t: now, s: n.session?.pct ?? null, sr: n.session?.resetsAt ?? null, w: n.week?.pct ?? null, m: n.model?.pct ?? null });
  const readings = ctx.history.read('claude', 8, now);
  return { ...n, days: dailyUse(readings, now), curve: sessionCurve(readings, n.session) };
}

// Dados de exemplo, iguais aos dos mocks (DEMO=1).
export function demo() {
  const now = Date.now();
  const resetsAt = now + 101 * 60_000;
  const start = resetsAt - SESSION_MS;
  const shape = [0, 3, 5, 9, 16, 22, 25, 31, 40, 48, 62];
  const sat = new Date(now); sat.setHours(9, 0, 0, 0);
  sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const vals = [30, 55, 20, 80, 45, 65, 100];
  return {
    session: { pct: 62, resetsAt },
    model: { pct: 78, resetsAt: sat.getTime(), key: 'seven_day_fable', label: 'Fable' },
    week: { pct: 41, resetsAt: sat.getTime() },
    keys: ['seven_day_fable'],
    days: vals.map((v, i) => ({ t: mid.getTime() - (6 - i) * 86400_000, value: v / 10 })),
    curve: shape.map((pct, i) => ({ t: start + ((now - start) * i) / (shape.length - 1), pct })),
  };
}
