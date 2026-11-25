// Uso do Claude: anéis e barras (tela 1), linha fina (tela 2), curva da sessão (tela 3).
import { esc, hm, pct, resetText, noData, cardHead, WD, SG, LABEL } from '/panel/lib.js';
import { usageMood, SESSION_MS, WEEK_MS } from '/panel/mood.js';

const AMBER = '#F5A524', LILAC = '#C58AF9', BLUE = '#8AB4F8';
const C = 226.2; // circunferência do anel (r = 36)
const clampPct = (v) => Math.max(0, Math.min(100, v));

// compact: anel menor com o texto embaixo, para quando a coluna fica estreita (ex.: com GIF no card).
function ring(win, base, title, sub, now, windowMs, center = false, compact = false, size = 78) {
  const has = win && typeof win.pct === 'number';
  const mood = usageMood(win, base, windowMs, now);
  const color = mood.color;
  const note = win?.unlimited ? 'sem limite no plano' : !has ? 'sem dados'
    : mood.note ? `<span style="color: ${color}">${esc(mood.note)}</span>` : resetText(win.resetsAt, now);
  const dash = has ? (clampPct(win.pct) / 100) * C : 0;
  const arc = (size) => `<svg role="img" aria-label="${esc(title)} ${esc(sub)}: ${has ? pct(win.pct) : 'sem dados'}" width="${size}" height="${size}" viewBox="0 0 84 84" style="flex: none">
<circle cx="42" cy="42" r="36" fill="none" stroke="#1C1E22" stroke-width="7"/>
${dash > 0.5 ? `<circle cx="42" cy="42" r="36" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${C}" transform="rotate(-90 42 42)"/>` : ''}
<text x="42" y="49" text-anchor="middle" fill="${has ? '#E8EAED' : '#9AA0A6'}" font-family="'Space Grotesk', sans-serif" font-size="21" font-weight="500">${has ? pct(win.pct) : '—'}</text>
</svg>`;
  if (compact) {
    return `
<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 0; text-align: center">
${arc(66)}
<div style="font-size: 12px; color: #E8EAED; font-weight: 500; white-space: nowrap">${esc(title === 'Semana' ? sub === 'Todos modelos' ? 'Semana' : sub : title)}</div>
<div style="font-size: 10.5px; color: #9AA0A6; white-space: nowrap">${note}</div>
</div>`;
  }
  const big = size > 90; // anéis grandes (1 ou 2 contadores): texto maior também
  return `
<div style="display: flex; align-items: center; justify-content: ${center ? 'center' : 'flex-start'}; gap: ${big ? 14 : 8}px; min-width: 0">
${arc(size)}
<div style="min-width: 0">
<div style="font-size: ${big ? 16 : 13}px; color: #E8EAED; font-weight: 500">${esc(title)}</div>
<div style="font-size: ${big ? 13 : 11}px; color: #C4C7CC; white-space: nowrap">${esc(sub)}</div>
<div style="font-size: ${big ? 12.5 : 11}px; color: #9AA0A6; margin-top: ${big ? 8 : 6}px; white-space: nowrap">${note}</div>
</div>
</div>`;
}

// Uso diário dos últimos 7 dias em barras deitadas: um dia por linha, hoje primeiro (em âmbar) e depois os anteriores.
// O valor é quanto do limite semanal foi gasto naquele dia.
function barsH(days) {
  const max = Math.max(...days.map((d) => d.value), 0);
  const val = (v) => (v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`);
  // hoje primeiro, depois os dias anteriores (do mais recente ao mais antigo)
  const rows = [...days].reverse().map((d, i) => {
    const today = i === 0;
    const w = max > 0 && d.value > 0 ? Math.max(3, (d.value / max) * 100) : 0;
    return `<span style="font-size: 10.5px; color: ${today ? '#E8EAED' : '#9AA0A6'}; text-align: right">${today ? 'hoje' : WD[new Date(d.t).getDay()]}</span>
<div style="height: 7px; border-radius: 3px; background: #1C1E22; overflow: hidden"><div style="width: ${w.toFixed(0)}%; height: 100%; border-radius: 3px; background: ${today ? AMBER : '#3A3D44'}"></div></div>
<span style="font-size: 10px; color: ${today ? '#E8EAED' : '#6B7078'}; ${SG}">${val(d.value)}</span>`;
  }).join('\n');
  return `<div role="img" aria-label="Uso diário nos últimos sete dias" style="display: grid; grid-template-columns: auto minmax(0, 1fr) 28px; column-gap: 8px; row-gap: 3px; align-items: center; align-content: center; min-width: 0; height: 100%">
${rows}
</div>`;
}

// Contadores escolhidos no /admin (ordem e quais), sem os que o plano não tem (ex.: sessão no Ultra).
const COUNTERS = {
  session: (d) => ({ win: d?.session, base: AMBER, title: 'Sessão', sub: '5 horas', line: 'Sessão', windowMs: SESSION_MS }),
  model: (d) => ({ win: d?.model, base: LILAC, title: 'Semana', sub: d?.model?.label || 'Fable', line: d?.model?.label || 'Fable', windowMs: WEEK_MS }),
  week: (d) => ({ win: d?.week, base: BLUE, title: 'Semana', sub: 'Todos modelos', line: 'Semana', windowMs: WEEK_MS }),
};
const DEFAULT_VIEW = { counters: [{ id: 'session', enabled: true }, { id: 'model', enabled: true }, { id: 'week', enabled: true }], showStats: true, hideUnlimited: true };

export function pickCounters(d, view = DEFAULT_VIEW) {
  return (view.counters || DEFAULT_VIEW.counters)
    .filter((c) => c.enabled && COUNTERS[c.id])
    .map((c) => COUNTERS[c.id](d))
    .filter((c) => !(view.hideUnlimited && c.win?.unlimited));
}

// Tela 1: card inteiro.
// `right`: HTML opcional na ponta direita do card (ex.: GIF), numa coluna de largura fixa.
export function claudeCard(w, now, planLabel, view = DEFAULT_VIEW, right = '', headRight = '') {
  const head = cardHead(`Claude${planLabel ? ` · ${esc(planLabel)}` : ''}`, w, now, headRight);
  const d = w?.data;
  if (!d) {
    const msg = noData(w?.error ? 'sem dados · veja o motivo no /admin' : 'sem dados');
    return head + (right ? `<div style="flex: 1; min-height: 0; display: flex; gap: 14px">${msg}${right}</div>` : msg);
  }
  const rings = pickCounters(d, view);
  const stats = view.showStats !== false || rings.length === 0; // o card nunca fica vazio
  // A estatística (barras deitadas) tem largura fixa e o GIF também; os anéis dividem o resto.
  // Com 1 ou 2 anéis eles crescem; se a coluna de cada anel ficar estreita, viram compactos (texto embaixo).
  const W = 722, GAP = 14, GIF = right ? 124 : 0;
  const STATS = !stats ? 0 : !rings.length ? W - GIF - (right ? GAP : 0) : right ? 140 : rings.length >= 3 ? 150 : 170;
  const n = rings.length;
  const colW = n ? (W - STATS - GIF - GAP * (n + (stats ? 1 : 0) + (right ? 1 : 0) - 1)) / n : 0;
  const compact = n > 0 && colW < 170;
  const size = n <= 2 ? (right ? 96 : 108) : 78;
  const cols = [...rings.map(() => 'minmax(0, 1fr)'), ...(stats ? [`${STATS}px`] : []), ...(right ? [`${GIF}px`] : [])].join(' ');
  return `${head}
<div style="display: grid; grid-template-columns: ${cols}; gap: 14px; flex: 1; min-height: 0">
${rings.map((c) => ring(c.win, c.base, c.title, c.sub, now, c.windowMs, !stats || n === 1, compact, size)).join('\n')}
${stats ? barsH(d.days) : ''}
${right}
</div>`;
}

// Tela 2: três medidores numa linha fina.
export function claudeLine(w, now = Date.now(), view = DEFAULT_VIEW) {
  const d = w?.data;
  const item = (label, win, base, windowMs) => {
    const v = win && typeof win.pct === 'number' ? win.pct : null;
    const color = usageMood(win, base, windowMs, now).color;
    return `
<div style="flex: 1; min-width: 0">
<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 11px; color: #9AA0A6">${esc(label)}</span><span style="${SG}; font-size: 20px; font-weight: 500; color: #C4C7CC">${v === null ? '—' : pct(v)}</span></div>
<div style="height: 3px; border-radius: 2px; background: #1C1E22; margin-top: 4px"><div style="width: ${v === null ? 0 : clampPct(v)}%; height: 3px; border-radius: 2px; background: ${color}"></div></div>
</div>`;
  };
  return `
<div style="${LABEL}">Claude${d ? '' : ' · sem dados'}</div>
<div style="display: flex; gap: 16px">
${(pickCounters(d, view).length ? pickCounters(d, view) : pickCounters(d, { ...view, hideUnlimited: false })).map((c) => item(c.line, c.win, c.base, c.windowMs)).join('\n')}
</div>`;
}

// Tela 3: uso acumulado na sessão de 5 h, com projeção tracejada até a renovação.
export function sessionChart(w, now) {
  const X0 = 40, X1 = 490, Y0 = 160, Y100 = 30;
  const y = (p) => Y0 - (clampPct(p) / 100) * (Y0 - Y100);
  const grid = `<path d="M${X0} ${Y0}.0 H${X1}" stroke="#1C1E22" stroke-width="1"/><text x="32" y="164.0" text-anchor="end" fill="#9AA0A6" font-family="Inter, sans-serif" font-size="11">0</text><path d="M${X0} 95.0 H${X1}" stroke="#1C1E22" stroke-width="1"/><text x="32" y="99.0" text-anchor="end" fill="#9AA0A6" font-family="Inter, sans-serif" font-size="11">50</text><path d="M${X0} ${Y100}.0 H${X1}" stroke="#1C1E22" stroke-width="1" stroke-dasharray="4 5"/><text x="32" y="34.0" text-anchor="end" fill="#9AA0A6" font-family="Inter, sans-serif" font-size="11">100</text>`;
  const s = w?.data?.session;
  const title = 'Claude · sessão de 5 h, uso acumulado (%)';
  const frame = (right, body) => `
<div style="display: flex; justify-content: space-between; ${LABEL}"><span>${title}</span><span>${right}</span></div>
<svg role="img" aria-label="Uso acumulado da sessão de 5 horas" width="506" height="188" viewBox="0 0 506 188">
${grid}
${body}
</svg>`;
  const center = (msg) => `<text x="265" y="120" text-anchor="middle" fill="#9AA0A6" font-family="Inter, sans-serif" font-size="12">${msg}</text>`;
  if (!s) return frame('sem dados', center('sem dados'));
  if (s.unlimited) return frame('plano sem limite de 5 h', center('o seu plano não tem limite de 5 h'));
  if (!s.resetsAt || s.resetsAt <= now) return frame(`${pct(s.pct)} agora`, center('nenhuma sessão em andamento'));

  const LINE = usageMood(s, AMBER, SESSION_MS, now).color;
  const end = s.resetsAt, start = end - 5 * 3600_000;
  const x = (t) => X0 + ((Math.max(start, Math.min(end, t)) - start) / (end - start)) * (X1 - X0);
  // a curva começa em 0 no início da sessão e termina na leitura atual
  const pts = [{ t: start, pct: 0 }, ...(w.data.curve || []).filter((p) => p.t > start && p.t < now), { t: Math.min(now, end), pct: s.pct }];
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.pct).toFixed(1)}`).join(' ');
  const nx = x(now), ny = y(s.pct);

  // projeção linear pelo ritmo médio da sessão
  const elapsed = Math.max(1, now - start);
  const proj = (s.pct * (end - start)) / elapsed;
  let px = X1, py = y(proj), right = `no ritmo atual: ${pct(proj)} ao renovar`;
  if (proj > 100 && s.pct < 100) {
    const tFull = start + (elapsed * 100) / s.pct;
    px = x(tFull); py = Y100; right = `no ritmo atual: 100% às ${hm(tFull)}`;
  } else if (s.pct >= 100) { right = 'limite da sessão atingido'; px = nx; py = ny; }
  const anchorEnd = nx > 110;
  const hours = [0, 1, 2, 3, 4, 5].map((i) => `<text x="${(X0 + i * 90).toFixed(1)}" y="180" text-anchor="middle" fill="#9AA0A6" font-family="Inter, sans-serif" font-size="11">${hm(start + i * 3600_000)}</text>`).join('');
  return frame(right, `
<path d="${path} L${nx.toFixed(1)} ${Y0} L${X0}.0 ${Y0} Z" fill="${LINE}" fill-opacity="0.08"/>
<path d="${path}" fill="none" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${nx.toFixed(1)} ${ny.toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)}" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="3 5" stroke-linecap="round"/>
<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="4" fill="#000000" stroke="${LINE}" stroke-width="2"/>
<text x="${(anchorEnd ? nx - 10 : nx + 10).toFixed(1)}" y="${Math.max(16, ny - 8).toFixed(1)}" text-anchor="${anchorEnd ? 'end' : 'start'}" fill="#E8EAED" font-family="'Space Grotesk', sans-serif" font-size="14">${pct(s.pct)} agora</text>
${hours}`);
}
