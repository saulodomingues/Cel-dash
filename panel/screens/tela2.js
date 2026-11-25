// Tela 2, tempo em detalhe (layout D, aprovado em 25/11/2026). Sem molduras, duas linhas alinhadas:
//   agora (esquerda)            | próximas 24 h (direita)
//   hoje + relógio (esquerda)   | próximos 7 dias (direita)
import { clockSmall } from '/widgets/clock/view.js';
import { chart24, nowBlock, todayBlock, weekColumns } from '/widgets/weather/view.js';
import { clockMood } from '/panel/mood.js';

export function tela2({ data, now }) {
  const w = data.weather;
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 14px 18px 12px; background: #000000; color: #E8EAED; display: grid; grid-template-columns: 214px minmax(0, 1fr); grid-template-rows: 146px minmax(0, 1fr); column-gap: 26px; row-gap: 14px">
<section style="display: flex; flex-direction: column; gap: 6px; min-width: 0">${nowBlock(w, now)}</section>
<section style="display: flex; flex-direction: column; min-width: 0">${chart24(w, { width: 510, height: 130, noCity: true, pad: false, right: 'chuva em azul' })}</section>
<section style="display: flex; flex-direction: column; justify-content: space-between; min-width: 0">
<div style="display: flex; flex-direction: column; gap: 6px">${todayBlock(w)}</div>
<div>${clockSmall(now, 40, clockMood(now, w).digits)}</div>
</section>
<section style="display: flex; flex-direction: column; min-width: 0">${weekColumns(w)}</section>
</div>`;
}
