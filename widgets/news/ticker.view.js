// Letreiro (faixa fina com as manchetes passando), para o rodapé da tela principal.
// data-keep com a lista de manchetes: o painel reaproveita o mesmo elemento entre redesenhos,
// e o letreiro não volta ao começo a cada minuto.
import { esc } from '/panel/lib.js';
import { CRAWL_SPEED } from './catalog.shared.js';

const RED = '#E5484D';
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

export function tickerBar(items, crawl) {
  if (!items?.length) return '';
  const text = items.map((it) => `<b style="color: ${RED}; font-size: 9.5px; letter-spacing: .08em">${esc(it.source.toUpperCase())}</b>&nbsp; ${esc(it.title)}`).join('<span style="color: #3A3D44; padding: 0 10px">•</span>');
  // Burn-in: nada de bloco de cor cheio parado no canto. Só um ponto vermelho piscando, fundo e
  // borda quase pretos; o que acende de verdade é o texto, que está sempre andando.
  return `<div data-keep="ticker-${hash(items.map((i) => i.title).join('|') + crawl)}" data-speed="${CRAWL_SPEED[crawl] || 70}" style="grid-column: span 4; display: flex; align-items: center; overflow: hidden; white-space: nowrap; border-radius: 6px; background: #08090A; border: 1px solid #111316; font-size: 11.5px">
<span style="flex: none; height: 100%; display: flex; align-items: center; padding: 0 8px 0 10px"><span style="width: 6px; height: 6px; border-radius: 50%; background: ${RED}; animation: ticker-blink 1.4s ease-in-out infinite"></span></span>
<span style="overflow: hidden; flex: 1"><span data-ticker-track style="display: inline-block; padding-left: 100%; color: #C4C7CC; animation: ticker-crawl 60s linear infinite">${text}</span></span>
<style>@keyframes ticker-crawl { to { transform: translateX(-100%); } } @keyframes ticker-blink { 50% { opacity: 0.15; } }</style>
</div>`;
}

// Ajusta a duração para a velocidade ficar constante, seja qual for o tamanho do texto.
export function mountTicker(root) {
  const bar = root.querySelector('[data-keep^="ticker-"]');
  const track = bar?.querySelector('[data-ticker-track]');
  if (!track || track.dataset.ready) return;
  track.dataset.ready = '1';
  track.style.animationDuration = `${Math.max(10, (track.scrollWidth + track.parentElement.clientWidth) / Number(bar.dataset.speed || 70))}s`;
}
