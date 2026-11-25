// Tela 2, tempo em detalhe (layout D, aprovado em 25/11/2026). Sem molduras e sem relógio, duas linhas alinhadas:
//   agora (esquerda)                                  | próximas 24 h (direita)
//   chuva, umidade, UV e vento em coluna (esquerda)   | próximos 7 dias (direita)
import { chart24, nowBlock, todayBlock, weekColumns } from '/widgets/weather/view.js';

export function tela2({ data, now }) {
  const w = data.weather;
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 14px 18px 12px; background: #000000; color: #E8EAED; display: grid; grid-template-columns: 214px minmax(0, 1fr); grid-template-rows: 124px minmax(0, 1fr); column-gap: 26px; row-gap: 28px">
<section style="display: flex; flex-direction: column; gap: 6px; min-width: 0">${nowBlock(w, now)}</section>
<section style="display: flex; flex-direction: column; min-width: 0">${chart24(w, { width: 510, height: 104, noCity: true, pad: false, right: 'chuva em azul' })}</section>
<section style="min-width: 0; min-height: 0">${todayBlock(w)}</section>
<section style="display: flex; flex-direction: column; min-width: 0">${weekColumns(w, 74)}</section>
</div>`;
}
