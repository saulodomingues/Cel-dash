// Tela "Manchetes": manchete grande que troca sozinha, "a seguir" e barra de tempo. O letreiro "AGORA"
// fica na tela principal (opcional), em ticker.js.
// O HTML só muda quando chegam manchetes novas; a troca e o letreiro são feitos por mountNews,
// que roda no navegador sem redesenhar a tela (o painel redesenha a cada minuto).
import { esc, ago } from '/panel/lib.js';
import { clockMood } from '/panel/mood.js';

const RED = '#E5484D';

export function newsScreen({ data, config, now = Date.now() }) {
  const w = data.news;
  const items = w?.data?.items || [];
  const n = config.news;
  const payload = esc(JSON.stringify({ items, at: w?.at || null, sources: w?.data?.sources ?? null, sec: n.seconds}));
  return `
<style>
#news .story { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; transition: transform .7s ease, opacity .7s ease; }
#news .story.out { transform: translateY(-40px); opacity: 0; }
#news .story.in { transform: translateY(40px); opacity: 0; }
</style>
<div id="news" data-news="${payload}" style="width: 780px; height: 360px; box-sizing: border-box; padding: 16px 22px 0; background: #000000; color: #E8EAED; display: flex; flex-direction: column; font-family: Inter, system-ui, sans-serif">
<div style="display: flex; align-items: center; gap: 10px">
<span style="color: ${RED}; font-size: 12px; font-weight: 600; letter-spacing: 0.12em">● MANCHETES</span>
<span data-news-age style="font-size: 11.5px; color: #9AA0A6"></span>
<span style="margin-left: auto; display: flex; align-items: baseline; gap: 8px"><span data-clock="hm" style="font-family: 'Space Grotesk', sans-serif; font-size: 24px; color: ${clockMood(now, data.weather).digits}"></span><span data-clock="short" style="font-size: 12px; color: #9AA0A6"></span></span>
</div>
<div data-news-main style="position: relative; flex: 1; min-height: 0; overflow: hidden">${items.length ? '' : `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #9AA0A6; font-size: 13px">${w?.error ? 'sem manchetes · veja o motivo no /admin' : 'carregando manchetes…'}</div>`}</div>
<div data-news-next style="font-size: 12.5px; color: #6B7078; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"></div>
<div style="height: 3px; background: #1C1E22; border-radius: 2px; overflow: hidden; margin-bottom: 18px"><div data-news-bar style="height: 100%; width: 0; background: ${RED}"></div></div>
</div>`;
}

const rel = (t, now) => {
  if (!t) return '';
  const m = Math.round((now - t) / 60_000);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`;
};

let timer = null;
// Última manchete mostrada, para continuar de onde parou quando a tela volta na rotação ou
// quando chegam manchetes novas. Procura essa manchete na lista atual; se ela saiu da lista,
// segue pela mesma posição. Nunca volta para a primeira sem motivo.
const resume = { title: '', i: -1 };
export function mountNews(root) {
  clearInterval(timer);
  const el = root.querySelector('#news');
  if (!el) return;
  const cfg = JSON.parse(el.dataset.news);
  const items = cfg.items;
  const main = el.querySelector('[data-news-main]'), next = el.querySelector('[data-news-next]');
  const bar = el.querySelector('[data-news-bar]'), age = el.querySelector('[data-news-age]');
  const updAge = () => { age.textContent = [ago({ at: cfg.at }, Date.now()), cfg.sources ? `${cfg.sources} ${cfg.sources > 1 ? 'fontes' : 'fonte'}` : ''].filter(Boolean).join(' · '); };
  updAge();
  if (!items.length) return;
  const found = items.findIndex((x) => x.title === resume.title);
  let i = found >= 0 ? found : resume.i >= 0 ? (resume.i - 1 + items.length) % items.length : -1;
  let cur = null;
  const show = () => {
    if (!el.isConnected) { clearInterval(timer); return; }
    i = (i + 1) % items.length;
    Object.assign(resume, { title: items[i].title, i });
    const it = items[i], now = Date.now();
    const s = document.createElement('div');
    s.className = 'story in';
    s.innerHTML = `<div><span style="color: ${RED}; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase">${esc(it.source)}</span> <span style="font-size: 12px; color: #6B7078">· ${[rel(it.t, now), `${i + 1}/${items.length}`].filter(Boolean).join(' · ')}</span></div>
<div style="font-size: ${it.title.length > 110 ? 26 : 31}px; line-height: 1.18; font-weight: 600; letter-spacing: -0.015em; margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">${esc(it.title)}</div>
${it.summary ? `<div style="font-size: 15px; line-height: 1.4; color: #9AA0A6; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden">${esc(it.summary)}</div>` : ''}`;
    main.appendChild(s);
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('in')));
    if (cur) { const old = cur; old.classList.add('out'); setTimeout(() => old.remove(), 800); }
    cur = s;
    next.textContent = items.length > 1 ? `A seguir: ${items[(i + 1) % items.length].title}` : '';
    bar.style.transition = 'none'; bar.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${cfg.sec * 1000}ms linear`; bar.style.width = '100%'; }));
    updAge();
  };
  show();
  timer = setInterval(show, cfg.sec * 1000);
}
