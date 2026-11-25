// Relógio. Não tem coletor: usa a hora do próprio aparelho.
// Os elementos com data-clock são atualizados a cada segundo pelo painel.
import { esc, hm, pad, dateLong, dateShort, SG } from '/panel/lib.js';

// Tela 1: relógio grande com cidade, status e IP.
// Status "online · IP" (toque abre o /admin). Fica no cabeçalho do card do Claude, alinhado à direita.
export function statusBadge(sys) {
  const online = sys?.data ? sys.data.online : null;
  const dot = online === null ? '#9AA0A6' : online ? '#4ADE80' : '#F5A524';
  const status = [online === null ? 'sem dados' : online ? 'online' : 'sem internet', sys?.data?.ip].filter(Boolean).join(' · ');
  return `<span data-admin title="Configurações" style="display: flex; align-items: center; gap: 6px; padding: 8px 0 8px 16px; margin: -8px 0; font-size: 11px; color: #9AA0A6; letter-spacing: 0.04em; white-space: nowrap"><span style="width: 6px; height: 6px; border-radius: 50%; background: ${dot}"></span>${esc(status)}</span>`;
}

// `extra`: HTML de um widget para o lado direito (calendário, cotações ou GIF), na altura toda do
// card. Com ele, o relógio encolhe um pouco para os dois caberem lado a lado.
export function clockCard(now, city, digits = '#C4C7CC', extra = '') {
  const [big, small, date] = extra ? [64, 20, 13] : [84, 26, 15];
  const clock = `
<div style="display: flex; align-items: baseline; gap: 5px; ${SG}">
<span data-clock="hm" style="font-size: ${big}px; line-height: 1; font-weight: 500; letter-spacing: -0.03em; color: ${digits}">${hm(now)}</span>
<span data-clock="s" style="font-size: ${small}px; color: #9AA0A6">${pad(new Date(now).getSeconds())}</span>
</div>
<div data-clock="long" style="font-size: ${date}px; color: #C4C7CC; white-space: nowrap">${dateLong(now)}</div>`;
  const cityLine = `<div style="font-size: 11px; color: #9AA0A6; letter-spacing: 0.04em">${esc(city)}</div>`;
  if (!extra) return `${cityLine}${clock}`;
  return `<div style="flex: 1; min-height: 0; display: flex; justify-content: space-between; gap: 10px">
<div style="min-width: 0; display: flex; flex-direction: column; justify-content: space-between">${cityLine}${clock}</div>
<div style="display: flex; align-items: center">${extra}</div>
</div>`;
}

// Telas 2 e 3: relógio pequeno de canto.
export function clockSmall(now, size, digits = '#C4C7CC') {
  return `
<div data-clock="hm" style="${SG}; font-size: ${size}px; line-height: 1; font-weight: 500; letter-spacing: -0.02em; color: ${digits}">${hm(now)}</div>
<div data-clock="short" style="font-size: 12px; color: #9AA0A6; margin-top: 6px">${dateShort(now)}</div>`;
}

export function tick(root, now) {
  for (const el of root.querySelectorAll('[data-clock]')) {
    const k = el.dataset.clock;
    const v = k === 'hm' ? hm(now) : k === 's' ? pad(new Date(now).getSeconds()) : k === 'long' ? dateLong(now) : dateShort(now);
    if (el.textContent !== v) el.textContent = v;
  }
}
