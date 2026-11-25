// Widget de GIF: a imagem animada num espaço qualquer da tela (hoje: ao lado do relógio).
// data-keep faz o painel reaproveitar o mesmo <img> entre redesenhos, para a animação não reiniciar.
import { esc } from '/panel/lib.js';

// file '*': alterna entre todos os GIFs enviados, um a cada passagem pela tela (`visit`).
export function gifWidget(config, file, { width = 112, fit, visit = 0 } = {}) {
  const items = config.gif?.items || [];
  const it = file === '*' ? items[visit % Math.max(1, items.length)] : items.find((i) => i.file === file) || items[0];
  if (!it) return '';
  return `<div style="width: ${width}px; align-self: stretch; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 8px">
<img data-keep src="/media/${esc(it.file)}" alt="" style="width: 100%; height: 100%; object-fit: ${(fit || config.gif.fit) === 'cover' ? 'cover' : 'contain'}">
</div>`;
}
