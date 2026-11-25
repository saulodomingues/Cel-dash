// Tela 3, saúde do sistema: lista e relógio à esquerda; curva da sessão e latência à direita.
import { clockSmall } from '/widgets/clock/view.js';
import { sessionChart } from '/widgets/claude/view.js';
import { systemList, latencyChart } from '/widgets/system/view.js';
import { clockMood } from '/panel/mood.js';

export function tela3({ data, now }) {
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 14px 24px; background: #000000; color: #E8EAED; display: flex; gap: 28px">
<div style="width: 198px; display: flex; flex-direction: column; justify-content: space-between">
<section style="display: flex; flex-direction: column; gap: 11px">${systemList(data.system)}</section>
<section>${clockSmall(now, 50, clockMood(now, data.weather).digits)}</section>
</div>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between">
<section style="display: flex; flex-direction: column; gap: 4px">${sessionChart(data.claude, now)}</section>
<section style="display: flex; flex-direction: column; gap: 2px">${latencyChart(data.system)}</section>
</div>
</div>`;
}
