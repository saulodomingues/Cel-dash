// Cotações para o espaço ao lado do relógio (tela 1). Só busca quando esse espaço mostra cotações.
// Moedas e cripto pela AwesomeAPI; índices pelo gráfico do Yahoo Finance (não oficial).
// Um item que falhar fica de fora; o resto segue.
import { CATALOG } from './catalog.shared.js';

export const id = 'quotes';
export const intervalMs = (cfg) => cfg.quotes.intervalMin * 60_000;

const num = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

// {"USDBRL": {"bid": "5.42", "pctChange": "0.21", "timestamp": "1764072000", ...}, ...}
export function parseAwesome(j, items) {
  const out = {};
  for (const it of items) {
    const q = j?.[it.pair.replace('-', '')];
    const value = num(q?.bid);
    if (!Number.isFinite(value)) continue;
    out[it.id] = { value, pct: num(q.pctChange), at: num(q.timestamp) ? num(q.timestamp) * 1000 : null };
  }
  return out;
}

// {"chart": {"result": [{"meta": {"regularMarketPrice": 131200.5, "chartPreviousClose": 130500, "regularMarketTime": 1764072000}}]}}
export function parseYahoo(j) {
  const m = j?.chart?.result?.[0]?.meta;
  const value = num(m?.regularMarketPrice);
  if (!Number.isFinite(value)) return null;
  const prev = num(m.chartPreviousClose ?? m.previousClose);
  return { value, pct: prev ? ((value - prev) / prev) * 100 : null, at: m.regularMarketTime ? m.regularMarketTime * 1000 : null };
}

const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) monitor-mesa', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`${new URL(url).host} respondeu ${r.status}`);
  return r.json();
};

export async function collect({ config }) {
  if (config.tela1.clockExtra !== 'quotes') return { items: [], idle: true };
  const chosen = config.quotes.items.map((id) => CATALOG.find((c) => c.id === id)).filter(Boolean);
  const aw = chosen.filter((c) => c.src === 'awesome');
  const yh = chosen.filter((c) => c.src === 'yahoo');
  const values = {};
  const errors = [];
  if (aw.length) {
    try { Object.assign(values, parseAwesome(await get(`https://economia.awesomeapi.com.br/json/last/${aw.map((c) => c.pair).join(',')}`), aw)); }
    catch (e) { errors.push(`câmbio: ${e.message}`); }
  }
  await Promise.all(yh.map(async (c) => {
    try {
      const v = parseYahoo(await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}?range=1d&interval=1d`));
      if (v) values[c.id] = v;
    } catch (e) { errors.push(`${c.label}: ${e.message}`); }
  }));
  const items = chosen.map((c) => ({ id: c.id, label: c.label, kind: c.kind, ...values[c.id] })).filter((x) => typeof x.value === 'number');
  if (!items.length && chosen.length) throw new Error(errors.join(' · ') || 'Nenhuma cotação veio.');
  return { items, errors };
}

// Dados de exemplo, iguais aos do mock (DEMO=1).
export function demo({ config }) {
  const ex = { USD: [5.42, 0.3], EUR: [5.91, -0.2], GBP: [6.88, 0.1], CHF: [6.12, 0.05], CNY: [0.75, -0.1], ARS: [0.0054, -0.4], JPY: [0.036, 0.2], BTC: [98400, 1.8], ETH: [3410, 2.1], IBOV: [131200, -0.6], SPX: [6012, 0.4], NDX: [19850, 0.7], DJI: [44100, 0.2], DAX: [19300, -0.3], FTSE: [8250, 0.1], N225: [38700, -0.5] };
  const now = Date.now();
  return {
    items: config.quotes.items.map((id) => CATALOG.find((c) => c.id === id)).filter(Boolean)
      .map((c) => ({ id: c.id, label: c.label, kind: c.kind, value: ex[c.id][0], pct: ex[c.id][1], at: now - 15 * 60_000 })),
    errors: [],
  };
}
