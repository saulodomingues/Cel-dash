// Cotações na coluna ao lado do relógio (tela 1): código, valor curto e seta de alta/queda.
import { esc, hm } from '/panel/lib.js';
import { fmtQuote } from './catalog.shared.js';

const UP = '#4ADE80', DOWN = '#F87171';

export function quotesWidget(w, now, width = 112) {
  const d = w?.data;
  const items = d?.items || [];
  const head = (right) => `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #9AA0A6; letter-spacing: 0.04em"><span>cotações</span><span style="color: #6B7078">${right}</span></div>`;
  if (!items.length) {
    return `<div style="width: ${width}px; display: flex; flex-direction: column; gap: 6px">${head('')}<div style="font-size: 10.5px; color: #6B7078">${w?.error ? 'sem conexão' : 'carregando…'}</div></div>`;
  }
  // hora da cotação mais antiga entre as mostradas (índices costumam vir com atraso)
  const oldest = Math.min(...items.map((i) => i.at || now));
  const rows = items.map((i) => {
    const up = typeof i.pct === 'number' && i.pct > 0.005, down = typeof i.pct === 'number' && i.pct < -0.005;
    const arrow = up ? `<span style="color: ${UP}">▲</span>` : down ? `<span style="color: ${DOWN}">▼</span>` : '<span style="color: #6B7078">–</span>';
    const tip = typeof i.pct === 'number' ? `${i.pct > 0 ? '+' : ''}${i.pct.toFixed(2).replace('.', ',')}%` : '';
    return `<span style="color: #9AA0A6">${esc(i.label)}</span><span title="${tip}" style="color: #E8EAED; text-align: right; font-family: 'Space Grotesk', sans-serif">${fmtQuote(i.value, i.kind)}</span><span style="font-size: 7px; text-align: center">${arrow}</span>`;
  }).join('');
  return `
<div style="width: ${width}px; display: flex; flex-direction: column; gap: 5px">
${head(hm(oldest))}
<div style="display: grid; grid-template-columns: auto minmax(0, 1fr) 9px; column-gap: 6px; row-gap: 3px; align-items: center; font-size: 11px; line-height: 14px; white-space: nowrap">
${rows}
</div>
</div>`;
}
