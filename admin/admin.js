// /admin: telas e configurações. Funciona no navegador do PC e no próprio celular.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCREEN_NAMES = { tela1: ['Principal', 'Relógio, tempo e uso do Claude'], tela2: ['Tempo em detalhe', 'Próximas 24 h, sol e Claude em linha'], tela3: ['Saúde do sistema', 'S22, curva da sessão e latência'] };
const WIDGET_NAMES = { weather: 'Tempo', claude: 'Uso do Claude', system: 'Sistema do S22' };
let S = null; // { config, secrets, status, server, demo }
let dirty = false;

async function call(method, path, body) {
  const r = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.endsWith('/login') && !path.endsWith('/password')) { boot(); throw new Error(j.error || 'Sessão expirada.'); }
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

// ---------- entrada ----------
async function boot() {
  const s = await call('GET', '/api/admin/session');
  if (s.logged) return load();
  const setup = s.needsSetup;
  app.innerHTML = `
<div class="card login">
<h1>Painel S22</h1>
<p class="muted">${setup ? 'Primeiro acesso: crie a senha das configurações (mínimo de 6 caracteres).' : 'Entre com a senha das configurações.'}</p>
<form id="login">
<label>Senha<input type="password" name="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required minlength="${setup ? 6 : 1}" autofocus></label>
<button class="primary">${setup ? 'Criar senha' : 'Entrar'}</button>
<a href="/">Voltar ao painel</a>
</form>
</div>`;
  document.getElementById('login').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    await call('POST', setup ? '/api/admin/setup' : '/api/admin/login', { password: e.target.password.value });
    await load();
  }));
}

async function load() {
  S = await call('GET', '/api/admin/config');
  dirty = false;
  render();
}

// ---------- campos ----------
const get = (path) => path.split('.').reduce((o, k) => o?.[k], S.config);
function set(path, v) {
  const ks = path.split('.'); const last = ks.pop();
  ks.reduce((o, k) => o[k], S.config)[last] = v;
  dirty = true; document.getElementById('save').disabled = false;
}
function field(path, label, type = 'number', attrs = '') {
  const v = get(path);
  if (type === 'checkbox') return `<label class="check"><input type="checkbox" data-path="${path}" ${v ? 'checked' : ''}>${label}</label>`;
  return `<label>${label}<input type="${type}" data-path="${path}" value="${esc(v)}" ${attrs}></label>`;
}

function ago(t) {
  if (!t) return 'nunca';
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.floor(m / 60)} h`;
}

function statusRows() {
  return Object.entries(S.status).map(([id, st]) => {
    const color = st.error ? 'var(--amber)' : st.at ? 'var(--green)' : 'var(--muted)';
    return `
<span class="dot" style="background:${color}"></span>
<div><b style="font-weight:500">${WIDGET_NAMES[id] || id}</b> <span class="muted">· última leitura ${ago(st.at)}</span>${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}</div>
<button data-collect="${id}">Coletar agora</button>`;
  }).join('');
}

function screensList() {
  return S.config.screens.map((s, i) => {
    const [name, desc] = SCREEN_NAMES[s.id] || [s.id, ''];
    return `
<div class="screen ${s.enabled ? '' : 'off'}">
<div class="thumb"><iframe src="/?preview&screen=${s.id}" title="Prévia: ${esc(name)}" loading="lazy" tabindex="-1"></iframe></div>
<div class="info"><b>${i + 1}. ${esc(name)}</b><div class="muted">${esc(desc)}</div>
<label class="check"><input type="checkbox" data-screen="${i}" ${s.enabled ? 'checked' : ''}>Mostrar na rotação</label></div>
<div class="moves"><button data-move="${i}:-1" aria-label="Subir ${esc(name)}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-move="${i}:1" aria-label="Descer ${esc(name)}" ${i === S.config.screens.length - 1 ? 'disabled' : ''}>↓</button></div>
</div>`;
  }).join('');
}

function claudeInfo() {
  const d = S.status.claude?.data;
  const keys = d?.keys || [];
  const cur = S.config.claude.modelKey;
  const opts = ['auto', ...new Set([...keys, ...(cur !== 'auto' ? [cur] : [])])];
  const sec = S.secrets;
  return `
<div class="grid">
<label>Origem das credenciais<select data-path="claude.source">
<option value="file" ${S.config.claude.source === 'file' ? 'selected' : ''}>Arquivo do Claude Code neste aparelho</option>
<option value="manual" ${S.config.claude.source === 'manual' ? 'selected' : ''}>Credenciais coladas aqui</option>
</select></label>
${field('claude.credentialsFile', 'Arquivo de credenciais', 'text')}
${field('claude.intervalMin', 'Coletar a cada (min)', 'number', 'min="5" max="180"')}
<label>Limite semanal por modelo<select data-path="claude.modelKey">${opts.map((k) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${k === 'auto' ? 'Automático (Fable, se existir)' : esc(k)}</option>`).join('')}</select></label>
${field('claude.planLabel', 'Rótulo do plano', 'text')}
</div>
<p class="muted" style="margin-top:12px">${d ? `Limites por modelo que a sua conta expõe: ${keys.length ? keys.map((k) => `<code>${esc(k)}</code>`).join(' ') : 'nenhum'}. Em uso: ${d.model ? `<code>${esc(d.model.key)}</code>` : 'nenhum (o anel do meio fica sem dados)'}.` : 'Ainda não houve uma leitura boa; os limites por modelo aparecem aqui depois dela.'}</p>
<div class="row" style="margin-top:12px">
<label><span>Colar credenciais (conteúdo de <code>.credentials.json</code> ou só o access token)</span><textarea id="creds" placeholder='{"claudeAiOauth":{"accessToken":"…","refreshToken":"…","expiresAt":…}}' autocomplete="off" spellcheck="false"></textarea></label>
</div>
<div class="row" style="margin-top:8px">
<button id="saveCreds">Salvar credenciais coladas</button>
<button id="clearCreds" ${sec.claudeManual ? '' : 'disabled'}>Apagar</button>
<span class="muted">${sec.claudeManual ? `Salvas no aparelho${sec.claudeManualHasRefresh ? ', com renovação automática' : ', sem refresh token: valem só até expirar'}. Nunca são reexibidas.` : 'Nenhuma credencial colada.'}</span>
</div>`;
}

function render() {
  const ips = S.server.ips.map((ip) => `<code>http://${ip}:${S.server.port}/admin</code>`).join(' ');
  app.innerHTML = `
<header>
<div><h1>Painel S22</h1><p class="muted">${S.demo ? 'MODO DEMO: dados de exemplo. ' : ''}${ips ? `No PC, abra ${ips}` : `Porta ${S.server.port}`} · Node ${esc(S.server.node)}</p></div>
<div class="row"><a href="/">Voltar ao painel</a><button id="logout">Sair</button></div>
</header>

<section class="card"><h2>Telas</h2><p class="muted">Ordem e quais entram na rotação. A troca passa pelo preto; as três têm divisões e cantos de relógio diferentes de propósito.</p>
<div class="screens">${screensList()}</div>
<div class="grid" style="margin-top:12px">
${field('rotation.intervalSec', 'Trocar de tela a cada (s)', 'number', 'min="20" max="3600"')}
${field('rotation.tapNext', 'Toque na tela pula para a próxima', 'checkbox')}
</div></section>

<section class="card"><h2>Estado da coleta</h2><p class="muted">Se uma fonte falha, o painel mantém o último dado e segue funcionando.</p>
<div class="status">${statusRows()}</div></section>

<section class="card"><h2>Cidade do tempo</h2><p class="muted">Atual: ${esc(S.config.city.name)} (${S.config.city.lat.toFixed(3)}, ${S.config.city.lon.toFixed(3)}). Fonte: Open-Meteo.</p>
<form id="geo" class="row"><label>Buscar cidade<input type="text" id="geoq" placeholder="ex.: Campinas" autocomplete="off"></label><button>Buscar</button></form>
<div class="results" id="georesults"></div>
<div class="grid" style="margin-top:12px">${field('weather.intervalMin', 'Coletar a cada (min)', 'number', 'min="5" max="180"')}</div></section>

<section class="card"><h2>Claude</h2><p class="muted">Uso da assinatura via OAuth. O token fica só neste aparelho e é renovado sozinho.</p>${claudeInfo()}</section>

<section class="card"><h2>Brilho e descanso da tela</h2><p class="muted">Brilho, apagar e detecção de movimento são feitos pelo Fully Kiosk Browser; em outro navegador só o pixel shift e a rotação valem.</p>
<div class="grid">
${field('brightness.day', 'Brilho de dia (%)', 'number', 'min="1" max="100"')}
${field('brightness.night', 'Brilho à noite (%)', 'number', 'min="1" max="100"')}
${field('night.start', 'Noite começa', 'time')}
${field('night.end', 'Noite termina', 'time')}
${field('sleep.enabled', 'Apagar a tela em horário fixo', 'checkbox')}
${field('sleep.start', 'Apagar às', 'time')}
${field('sleep.end', 'Acender às', 'time')}
${field('idle.enabled', 'Tela ociosa sem movimento', 'checkbox')}
${field('idle.afterMin', 'Ociosa após (min sem movimento)', 'number', 'min="1" max="720"')}
${field('idle.offAfterMin', 'Apagar após mais (min; 0 = nunca)', 'number', 'min="0" max="720"')}
${field('pixelShift.intervalSec', 'Pixel shift a cada (s)', 'number', 'min="10" max="3600"')}
${field('pixelShift.maxPx', 'Deslocamento máximo (px)', 'number', 'min="0" max="8"')}
</div></section>

<section class="card"><h2>Sistema</h2><p class="muted">Bateria e Wi-Fi vêm do Termux:API. O limite de carga é só o número exibido; quem limita é a proteção de bateria do Android.</p>
<div class="grid">
${field('system.chargeLimit', 'Limite de carga exibido (%; 0 = ocultar)', 'number', 'min="0" max="100"')}
${field('system.intervalSec', 'Coletar a cada (s)', 'number', 'min="30" max="600"')}
${field('system.pingHost', 'Servidor do teste de latência', 'text')}
${field('system.pingPort', 'Porta do teste', 'number', 'min="1" max="65535"')}
${field('system.vpn.label', 'Rótulo do serviço monitorado', 'text')}
${field('system.vpn.host', 'IP do serviço (vazio = ocultar)', 'text')}
${field('system.vpn.port', 'Porta do serviço', 'number', 'min="1" max="65535"')}
${field('port', 'Porta do servidor (exige reinício)', 'number', 'min="1024" max="65535"')}
</div></section>

<section class="card"><h2>Senha</h2>
<form id="pw" class="row">
<label>Senha atual<input type="password" name="current" autocomplete="current-password" required></label>
<label>Nova senha<input type="password" name="next" autocomplete="new-password" required minlength="6"></label>
<button>Trocar senha</button>
</form></section>

<div class="savebar"><button id="reload">Recarregar o painel</button><button class="primary" id="save" ${dirty ? '' : 'disabled'}>Salvar e aplicar</button></div>`;
  wire();
}

function wire() {
  app.querySelectorAll('[data-path]').forEach((el) => el.addEventListener('change', () => {
    const p = el.dataset.path;
    set(p, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value);
  }));
  app.querySelectorAll('[data-screen]').forEach((el) => el.addEventListener('change', () => {
    S.config.screens[Number(el.dataset.screen)].enabled = el.checked;
    if (!S.config.screens.some((s) => s.enabled)) { S.config.screens[Number(el.dataset.screen)].enabled = true; toast('Pelo menos uma tela precisa ficar ativa.'); }
    dirty = true; render();
  }));
  app.querySelectorAll('[data-move]').forEach((el) => el.addEventListener('click', () => {
    const [i, d] = el.dataset.move.split(':').map(Number);
    const a = S.config.screens; [a[i], a[i + d]] = [a[i + d], a[i]];
    dirty = true; render();
  }));
  app.querySelectorAll('[data-collect]').forEach((el) => el.addEventListener('click', guard(async () => {
    el.disabled = true; el.textContent = 'Coletando…';
    const st = await call('POST', `/api/admin/collect/${el.dataset.collect}`);
    S.status[el.dataset.collect] = st;
    toast(st.error ? `Falhou: ${st.error}` : 'Leitura feita.');
    render();
  })));
  document.getElementById('save').addEventListener('click', guard(async () => {
    const r = await call('PUT', '/api/admin/config', S.config);
    S.config = r.config; dirty = false;
    toast(r.portChanged ? 'Salvo. A porta nova vale depois de reiniciar o servidor.' : 'Salvo. O painel já foi atualizado.');
    setTimeout(guard(load), 1500); // dá tempo de a coleta refeita terminar
  }));
  document.getElementById('reload').addEventListener('click', guard(async () => { await call('POST', '/api/admin/reload-panel'); toast('Painel recarregado.'); }));
  document.getElementById('logout').addEventListener('click', guard(async () => { await call('POST', '/api/admin/logout'); boot(); }));
  document.getElementById('geo').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    const box = document.getElementById('georesults');
    box.textContent = 'Buscando…';
    const { results } = await call('GET', `/api/admin/geocode?q=${encodeURIComponent(document.getElementById('geoq').value)}`).catch((err) => { box.textContent = ''; throw err; });
    box.innerHTML = results.length ? results.map((c, i) => `<button data-city="${i}">${esc(c.name)} <span class="muted">${esc(c.region)}</span></button>`).join('') : '<span class="muted">Nenhuma cidade encontrada.</span>';
    box.querySelectorAll('[data-city]').forEach((b) => b.addEventListener('click', () => {
      const c = results[Number(b.dataset.city)];
      S.config.city = { name: c.name, lat: c.lat, lon: c.lon };
      dirty = true; render();
      toast(`Cidade: ${c.name}. Falta salvar.`);
    }));
  }));
  const saveCreds = (value) => guard(async () => {
    const r = await call('PUT', '/api/admin/secrets/claude', { credentials: value() });
    S.secrets = r.secrets;
    if (value()) { S.config.claude.source = 'manual'; const c = await call('PUT', '/api/admin/config', S.config); S.config = c.config; dirty = false; }
    toast(value() ? 'Credenciais salvas. Testando a leitura…' : 'Credenciais apagadas.');
    if (value()) S.status.claude = await call('POST', '/api/admin/collect/claude');
    render();
    if (S.status.claude?.error) toast(`Falhou: ${S.status.claude.error}`);
  });
  document.getElementById('saveCreds').addEventListener('click', () => {
    const v = document.getElementById('creds').value.trim();
    if (!v) return toast('Cole as credenciais primeiro.');
    saveCreds(() => v)();
  });
  document.getElementById('clearCreds').addEventListener('click', saveCreds(() => ''));
  document.getElementById('pw').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    await call('POST', '/api/admin/password', { current: e.target.current.value, next: e.target.next.value });
    e.target.reset(); toast('Senha trocada.');
  }));
}

addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
boot().catch((e) => { app.innerHTML = `<div class="card login"><h1>Painel S22</h1><p class="muted">Não consegui falar com o servidor: ${esc(e.message)}</p></div>`; });
