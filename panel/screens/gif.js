// Tela de mídia: só um GIF (ou imagem) em tela cheia, sobre preto.
// Com várias imagens enviadas, cada passagem por esta tela mostra a próxima.
export function gif({ config, gifIndex = 0 }) {
  const items = config.gif?.items || [];
  if (!items.length) return '<div style="width: 780px; height: 360px; background: #000000"></div>';
  const it = items[gifIndex % items.length];
  return `
<div style="width: 780px; height: 360px; background: #000000; display: flex; align-items: center; justify-content: center; overflow: hidden">
<img data-keep src="/media/${it.file}" alt="" style="width: 100%; height: 100%; object-fit: ${config.gif.fit === 'cover' ? 'cover' : 'contain'}; image-rendering: auto">
</div>`;
}
