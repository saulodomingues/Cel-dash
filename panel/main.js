// Painel: recebe dados e configuração por SSE, alterna as telas e cuida do burn-in.
import { tela1, mount as mountTela1, beforeLeave as leaveTela1 } from './screens/tela1.js';
import { tela2 } from './screens/tela2.js';
import { tela3 } from './screens/tela3.js';
import { idle } from './screens/idle.js';
import { gif } from './screens/gif.js';
import { news, mount as mountNews } from './screens/news.js';
import { tick } from '/widgets/clock/view.js';
import * as burnin from './burnin.js';

const SCREENS = { tela1, tela2, tela3, gif, news };
// telas com parte animada própria: chamadas depois que o HTML muda
const MOUNT = { news: mountNews, tela1: mountTela1 };
// chamadas antes de trocar o conteúdo (guardam estado, ex.: onde o letreiro parou)
const BEFORE = [leaveTela1];
// telas que só entram na rotação se tiverem conteúdo
const HAS_CONTENT = { gif: (c) => (c.gif?.items || []).length > 0, news: (c, d) => (d.news?.data?.items || []).length > 0 };
const W = 780, H = 360;
const qs = new URLSearchParams(location.search);
const PINNED = qs.get('screen');       // ?screen=tela2 fixa uma tela
const PREVIEW = qs.has('preview');     // usado pelo /admin: sem toque, sem burn-in

const stage = document.getElementById('stage');
const blackout = document.getElementById('blackout');
const st = { gifIndex: 0, visit: 0, lastHtml: '', config: null, data: {}, current: null, mode: 'on', lastMinute: -1, lastRotate: Date.now(), fading: false };

const enabled = () => {
  if (PINNED && SCREENS[PINNED]) return [PINNED];
  const ids = st.config.screens.filter((s) => s.enabled && SCREENS[s.id] && (!HAS_CONTENT[s.id] || HAS_CONTENT[s.id](st.config, st.data))).map((s) => s.id);
  return ids.length ? ids : ['tela1'];
};

function render() {
  if (!st.config) return;
  const now = Date.now();
  const fn = st.mode === 'idle' ? idle : SCREENS[st.current] || tela1;
  try {
    const html = fn({ data: st.data, config: st.config, now, gifIndex: st.gifIndex, visit: st.visit });
    // não recria o que não mudou: senão o GIF recomeçaria a cada atualização de dado
    if (html !== st.lastHtml) {
      // imagens marcadas com data-keep (GIFs) voltam as mesmas: a animação segue sem reiniciar
      // elementos com data-keep (GIFs, letreiro) voltam os mesmos: a animação segue sem reiniciar
      const keyOf = (el) => el.getAttribute('data-keep') || el.getAttribute('src');
      for (const fn of BEFORE) fn(stage);
      const keep = new Map([...stage.querySelectorAll('[data-keep]')].map((el) => [keyOf(el), el]));
      stage.innerHTML = html; st.lastHtml = html;
      for (const n of stage.querySelectorAll('[data-keep]')) {
        const old = keep.get(keyOf(n));
        if (old) { old.setAttribute('style', n.getAttribute('style') || ''); n.replaceWith(old); keep.delete(keyOf(n)); }
      }
      if (st.mode !== 'idle' && MOUNT[st.current]) MOUNT[st.current](stage);
    }
  } catch (e) {
    // um widget com dado inesperado não pode deixar a tela em branco
    console.error(e);
    stage.innerHTML = `<div style="width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;color:#9AA0A6;font-size:12px">erro ao desenhar ${st.current}</div>`;
  }
}

function layout() {
  const scale = Math.min(innerWidth / W, innerHeight / H);
  const [dx, dy] = PREVIEW || !st.config ? [0, 0] : burnin.shiftOffset(Date.now(), st.config.pixelShift);
  stage.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
}

// Troca de tela passando pelo preto.
function show(id) {
  if (st.fading) return;
  st.fading = true;
  st.lastRotate = Date.now();
  stage.style.opacity = '0';
  setTimeout(() => {
    if (id === 'gif' && st.current !== 'gif') st.gifIndex++;
    if (id !== st.current) st.visit++;
    st.current = id;
    render();
    stage.style.opacity = '1';
    st.fading = false;
  }, 450);
}

// Quanto tempo a tela fica: o dela, ou o geral. Manchetes no automático: o tempo de passar
// todas as manchetes uma vez (mínimo de 30 s).
function screenMs(id) {
  const sc = st.config.screens.find((s) => s.id === id) || {};
  if (id === 'news' && sc.auto) {
    const n = (st.data.news?.data?.items || []).length;
    if (n) return Math.max(30, n * st.config.news.seconds) * 1000 + 1000;
  }
  return (sc.seconds || st.config.rotation.intervalSec) * 1000;
}

function next() {
  const ids = enabled();
  const i = ids.indexOf(st.current);
  if (ids.length > 1 || i < 0) show(ids[(i + 1) % ids.length]);
  else st.lastRotate = Date.now();
}

function loop() {
  if (!st.config) return;
  const now = Date.now();
  const m = PREVIEW ? 'on' : burnin.mode(now, st.config);
  if (m !== st.mode) {
    st.mode = m;
    blackout.style.display = m === 'off' ? 'block' : 'none';
    render();
  }
  if (!PREVIEW && st.config.display?.browser === 'fully') burnin.apply(now, st.config, m);
  if (!enabled().includes(st.current)) st.current = enabled()[0];
  if (m === 'on' && !PINNED && now - st.lastRotate >= screenMs(st.current)) next();
  const minute = Math.floor(now / 60_000);
  if (minute !== st.lastMinute) { st.lastMinute = minute; if (!st.fading) render(); }
  tick(stage, now);
  layout();
}

// ---------- dados ----------
// Recarrega a página (versão nova do painel ou pedido do /admin) guardando antes o que precisa
// continuar de onde parou, como o letreiro.
function reloadPage() {
  for (const fn of BEFORE) { try { fn(stage); } catch { /* segue */ } }
  location.reload();
}

function applyState(s) {
    // o servidor voltou com outra versão (atualização automática): recarrega para pegar o código novo
    if (st.version && s.version !== st.version) return reloadPage();
    st.version = s.version;
    st.config = s.config; st.data = s.data;
    if (!st.current) st.current = enabled()[0];
    render(); layout();
    stage.style.opacity = '1';
}

// Plano B: se o SSE não chegar (antivírus ou proxy segurando a conexão), busca o estado de tempos em tempos.
let lastEvent = 0;
async function poll() {
  if (Date.now() - lastEvent < 60_000) return;
  try { applyState(await (await fetch('/api/state', { cache: 'no-store' })).json()); } catch { /* servidor fora; tenta de novo */ }
}

function connect() {
  const es = new EventSource('/events');
  es.onmessage = () => { lastEvent = Date.now(); };
  for (const ev of ['state', 'data', 'config']) es.addEventListener(ev, () => { lastEvent = Date.now(); });
  es.addEventListener('state', (e) => {
    applyState(JSON.parse(e.data));
  });
  es.addEventListener('data', (e) => {
    const { id, state } = JSON.parse(e.data);
    st.data[id] = state;
    if (!st.fading) render();
  });
  es.addEventListener('config', (e) => { st.config = JSON.parse(e.data); if (!st.fading) render(); layout(); });
  es.addEventListener('reload', reloadPage);
  // o EventSource reconecta sozinho; ao voltar, o servidor reenvia o estado inteiro
}

// ---------- toque ----------
// toque curto: próxima tela (ou acorda). Toque no IP ou segurar 1,5 s: abre as configurações no próprio celular.
if (!PREVIEW) {
  let hold = null, held = false;
  addEventListener('pointerdown', () => {
    held = false;
    hold = setTimeout(() => { held = true; location.href = '/admin'; }, 1500);
  });
  addEventListener('pointerup', (e) => {
    clearTimeout(hold);
    if (held || !st.config) return;
    // toque no status/IP (canto superior direito da tela principal): abre as configurações
    if (st.mode === 'on' && e.target.closest?.('[data-admin]')) { location.href = '/admin'; return; }
    if (st.mode !== 'on') { burnin.wakeBriefly(); return; }
    burnin.activity();
    if (st.config.rotation.tapNext) next();
  });
  addEventListener('pointercancel', () => clearTimeout(hold));
  addEventListener('contextmenu', (e) => e.preventDefault());
  burnin.bindFully();
}

addEventListener('resize', layout);

// ---------- Chrome (sem Fully Kiosk) ----------
// Tela sempre ligada pelo próprio navegador. Só funciona em contexto seguro: no celular,
// abrindo por http://localhost:8080 (é o caso do app instalado na tela inicial).
let wake = null;
async function keepAwake() {
  if (PREVIEW || st.config?.display?.browser === 'fully' || burnin.hasFully() || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try { wake = await navigator.wakeLock.request('screen'); } catch { /* sem permissão: segue sem */ }
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();
// Registra o service worker mínimo, para o Chrome oferecer "Instalar app" (tela cheia).
if (!PREVIEW && 'serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
// As miniaturas do /admin (?preview) não abrem conexão contínua: o navegador permite só 6
// conexões por endereço, e 4 miniaturas + o painel em outra aba travavam o envio de GIFs.
if (PREVIEW) {
  poll();
  setInterval(poll, 30_000);
} else {
  connect();
  setTimeout(poll, 3000);
  setInterval(poll, 30_000);
}
setInterval(loop, 1000);
