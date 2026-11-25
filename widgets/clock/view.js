// Relógio. Não tem coletor: usa a hora do próprio aparelho.
// Os elementos com data-clock são atualizados a cada segundo pelo painel.
import { esc, hm, pad, dateLong, dateShort, SG } from '/panel/lib.js';

// Tela 1: relógio grande com cidade, status e IP.
export function clockCard(now, city, sys) {
  const online = sys?.data ? sys.data.online : null;
  const dot = online === null ? '#9AA0A6' : online ? '#4ADE80' : '#F5A524';
  const status = [online === null ? 'sem dados' : online ? 'online' : 'sem internet', sys?.data?.ip].filter(Boolean).join(' · ');
  return `
<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #9AA0A6; letter-spacing: 0.04em">
<span>${esc(city)}</span>
<span style="display: flex; align-items: center; gap: 6px"><span style="width: 6px; height: 6px; border-radius: 50%; background: ${dot}"></span>${esc(status)}</span>
</div>
<div style="display: flex; align-items: baseline; gap: 6px; ${SG}">
<span data-clock="hm" style="font-size: 84px; line-height: 1; font-weight: 500; letter-spacing: -0.03em; color: #C4C7CC">${hm(now)}</span>
<span data-clock="s" style="font-size: 26px; color: #9AA0A6">${pad(new Date(now).getSeconds())}</span>
</div>
<div data-clock="long" style="font-size: 15px; color: #C4C7CC">${dateLong(now)}</div>`;
}

// Telas 2 e 3: relógio pequeno de canto.
export function clockSmall(now, size) {
  return `
<div data-clock="hm" style="${SG}; font-size: ${size}px; line-height: 1; font-weight: 500; letter-spacing: -0.02em; color: #C4C7CC">${hm(now)}</div>
<div data-clock="short" style="font-size: 12px; color: #9AA0A6; margin-top: 6px">${dateShort(now)}</div>`;
}

export function tick(root, now) {
  for (const el of root.querySelectorAll('[data-clock]')) {
    const k = el.dataset.clock;
    const v = k === 'hm' ? hm(now) : k === 's' ? pad(new Date(now).getSeconds()) : k === 'long' ? dateLong(now) : dateShort(now);
    if (el.textContent !== v) el.textContent = v;
  }
}
