// Painel: recebe dados e configuração por SSE, alterna as telas e cuida do burn-in.
import { tela1 } from './screens/tela1.js';
import { tela2 } from './screens/tela2.js';
import { tela3 } from './screens/tela3.js';
import { idle } from './screens/idle.js';
import { tick } from '/widgets/clock/view.js';
import * as burnin from './burnin.js';

const SCREENS = { tela1, tela2, tela3 };
const W = 780, H = 360;
const qs = new URLSearchParams(location.search);
const PINNED = qs.get('screen');       // ?screen=tela2 fixa uma tela
const PREVIEW = qs.has('preview');     // usado pelo /admin: sem toque, sem burn-in

const stage = document.getElementById('stage');
const blackout = document.getElementById('blackout');
const st = { config: null, data: {}, current: null, mode: 'on', lastMinute: -1, lastRotate: Date.now(), fading: false };

const enabled = () => {
  if (PINNED && SCREENS[PINNED]) return [PINNED];
  const ids = st.config.screens.filter((s) => s.enabled && SCREENS[s.id]).map((s) => s.id);
  return ids.length ? ids : ['tela1'];
};

function render() {
  if (!st.config) return;
  const now = Date.now();
  const fn = st.mode === 'idle' ? idle : SCREENS[st.current] || tela1;
  try {
    stage.innerHTML = fn({ data: st.data, config: st.config, now });
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
    st.current = id;
    render();
    stage.style.opacity = '1';
    st.fading = false;
  }, 450);
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
  if (!PREVIEW) burnin.apply(now, st.config, m);
  if (!enabled().includes(st.current)) st.current = enabled()[0];
  if (m === 'on' && !PINNED && now - st.lastRotate >= st.config.rotation.intervalSec * 1000) next();
  const minute = Math.floor(now / 60_000);
  if (minute !== st.lastMinute) { st.lastMinute = minute; if (!st.fading) render(); }
  tick(stage, now);
  layout();
}

// ---------- dados ----------
function connect() {
  const es = new EventSource('/events');
  es.addEventListener('state', (e) => {
    const s = JSON.parse(e.data);
    // o servidor voltou com outra versão (atualização automática): recarrega para pegar o código novo
    if (st.version && s.version !== st.version) return location.reload();
    st.version = s.version;
    st.config = s.config; st.data = s.data;
    if (!st.current) st.current = enabled()[0];
    render(); layout();
    stage.style.opacity = '1';
  });
  es.addEventListener('data', (e) => {
    const { id, state } = JSON.parse(e.data);
    st.data[id] = state;
    if (!st.fading) render();
  });
  es.addEventListener('config', (e) => { st.config = JSON.parse(e.data); if (!st.fading) render(); layout(); });
  es.addEventListener('reload', () => location.reload());
  // o EventSource reconecta sozinho; ao voltar, o servidor reenvia o estado inteiro
}

// ---------- toque ----------
// toque curto: próxima tela (ou acorda). Segurar 1,5 s: abre as configurações no próprio celular.
if (!PREVIEW) {
  let hold = null, held = false;
  addEventListener('pointerdown', () => {
    held = false;
    hold = setTimeout(() => { held = true; location.href = '/admin'; }, 1500);
  });
  addEventListener('pointerup', () => {
    clearTimeout(hold);
    if (held || !st.config) return;
    if (st.mode !== 'on') { burnin.wakeBriefly(); return; }
    burnin.activity();
    if (st.config.rotation.tapNext) next();
  });
  addEventListener('pointercancel', () => clearTimeout(hold));
  addEventListener('contextmenu', (e) => e.preventDefault());
  burnin.bindFully();
}

addEventListener('resize', layout);
connect();
setInterval(loop, 1000);
