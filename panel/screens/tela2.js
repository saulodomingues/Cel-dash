// Tela 2, tempo em detalhe: curva de 24 h em cima; sol, chuva/umidade/UV de hoje e relógio embaixo. Sem molduras.
import { clockSmall } from '/widgets/clock/view.js';
import { chart24, sunArc, todayStats } from '/widgets/weather/view.js';
import { clockMood } from '/panel/mood.js';

export function tela2({ data, config, now }) {
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 12px; background: #000000; color: #E8EAED; display: flex; flex-direction: column; gap: 8px">
<section style="height: 206px; display: flex; flex-direction: column; gap: 4px">${chart24(data.weather)}</section>
<div style="flex: 1; min-height: 0; display: flex; gap: 20px; align-items: flex-end; padding: 0 12px 4px">
<section style="width: 190px; display: flex; flex-direction: column; gap: 2px">${sunArc(data.weather, now)}</section>
<section style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px">${todayStats(data.weather)}</section>
<section style="width: 170px; text-align: right">${clockSmall(now, 56, clockMood(now, data.weather).digits)}</section>
</div>
</div>`;
}
