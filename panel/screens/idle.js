// Tela ociosa: só o relógio em cinza escuro, em um lugar diferente a cada minuto.
import { hm, SG } from '/panel/lib.js';

export function idle({ now }) {
  const m = Math.floor(now / 60_000);
  // posições pseudoaleatórias estáveis dentro do minuto, cobrindo a tela toda ao longo do tempo
  const x = 24 + ((m * 73) % 560);
  const y = 20 + ((m * 41) % 250);
  return `
<div style="width: 780px; height: 360px; background: #000000; position: relative">
<div data-clock="hm" style="position: absolute; left: ${x}px; top: ${y}px; ${SG}; font-size: 64px; line-height: 1; font-weight: 500; letter-spacing: -0.02em; color: #3A3D44">${hm(now)}</div>
</div>`;
}
