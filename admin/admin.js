// /admin: telas e configurações. Funciona no navegador do PC e no próprio celular.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCREEN_NAMES = { tela1: ['Principal', 'Relógio, tempo e uso do Claude'], tela2: ['Tempo em detalhe', 'Próximas 24 h, sol e Claude em linha'], tela3: ['Saúde do sistema', 'S20, curva da sessão e latência'], gif: ['GIF', 'Só a imagem animada, em tela cheia. Envie abaixo.'] };
const WIDGET_NAMES = { weather: 'Tempo', claude: 'Uso do Claude', system: 'Sistema do S20' };
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
<h1>Painel S20</h1>
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

const COUNTER_NAMES = { session: ['Sessão de 5 h', 'some sozinho em plano sem esse limite'], model: ['Semana do modelo', 'Fable, ou o escolhido em Claude'], week: ['Semana, todos os modelos', ''] };
function counterList() {
  const list = S.config.claudeView.counters;
  return list.map((c, i) => {
    const [name, desc] = COUNTER_NAMES[c.id];
    return `
<div class="screen ${c.enabled ? '' : 'off'}" style="padding:8px 12px">
<div class="info"><label class="check" style="min-height:32px"><input type="checkbox" data-counter="${i}" ${c.enabled ? 'checked' : ''}>${esc(name)}</label>${desc ? `<div class="muted">${esc(desc)}</div>` : ''}</div>
<div class="moves"><button data-cmove="${i}:-1" aria-label="Subir ${esc(name)}" ${i === 0 ? 'disabled' : ''}>↑</button><button data-cmove="${i}:1" aria-label="Descer ${esc(name)}" ${i === list.length - 1 ? 'disabled' : ''}>↓</button></div>
</div>`;
  }).join('');
}

function claudeInfo() {
  const d = S.status.claude?.data;
  const st = S.status.claude || {};
  const keys = d?.keys || [];
  const cur = S.config.claude.modelKey;
  const opts = ['auto', ...new Set([...keys, ...(cur !== 'auto' ? [cur] : [])])];
  const sec = S.secrets;
  const connected = S.config.claude.source === 'manual' ? sec.claudeManual : Boolean(st.at);
  const state = connected && !st.error
    ? `<span class="dot" style="background:var(--green)"></span> Conta conectada${st.at ? ` · última leitura ${ago(st.at)}` : ''}`
    : connected ? `<span class="dot" style="background:var(--amber)"></span> Conectada, mas a leitura falhou: <span class="err">${esc(st.error)}</span>`
    : '<span class="dot" style="background:var(--muted)"></span> Conta não conectada';
  return `
<p style="margin-bottom:12px">${state}</p>
<div class="row"><button class="primary" id="claudeLogin">${connected ? 'Entrar de novo' : 'Entrar com a conta Claude'}</button>
<button id="clearCreds" ${sec.claudeManual ? '' : 'disabled'}>Desconectar</button></div>
<div id="loginStep" hidden style="margin-top:12px">
<p class="muted" style="margin-bottom:8px">1. Na aba que abriu, entre na sua conta Claude e clique em autorizar. <a id="loginLink" href="#" target="_blank" rel="noopener">Abrir de novo</a><br>2. A página mostra um código. Copie e cole aqui:</p>
<form id="loginFinish" class="row"><label>Código<input type="text" id="loginCode" autocomplete="off" spellcheck="false" required></label><button class="primary">Concluir</button></form>
</div>
<div class="grid" style="margin-top:16px">
<label>Anel do meio (limite semanal por modelo)<select data-path="claude.modelKey">${opts.map((k) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${k === 'auto' ? 'Automático (Fable, se existir)' : esc(k)}</option>`).join('')}</select></label>
${field('claude.intervalMin', 'Coletar a cada (min)', 'number', 'min="5" max="180"')}
${field('claude.planLabel', 'Rótulo do plano', 'text')}
</div>
<p class="muted" style="margin-top:12px">${d ? `Limites por modelo que a sua conta expõe: ${keys.length ? keys.map((k) => `<code>${esc(k)}</code>`).join(' ') : 'nenhum'}. Em uso: ${d.model ? `<code>${esc(d.model.key)}</code>` : 'nenhum (o anel do meio fica sem dados)'}.` : 'Os limites por modelo aparecem aqui depois da primeira leitura.'}</p>
<details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Resposta bruta da última leitura</summary>
<p class="muted" style="margin:8px 0">${S.claudeRaw ? `Lida ${ago(S.claudeRaw.at)}. Só percentuais e datas; não contém o token.` : 'Ainda não houve leitura desde que o servidor subiu.'}</p>
${S.claudeRaw ? `<textarea readonly style="min-height:220px">${esc(JSON.stringify(S.claudeRaw.body, null, 2))}</textarea>` : ''}
</details>
<details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Opções avançadas</summary>
<div class="grid" style="margin-top:12px">
<label>Origem das credenciais<select data-path="claude.source">
<option value="manual" ${S.config.claude.source === 'manual' ? 'selected' : ''}>Login feito aqui (ou credenciais coladas)</option>
<option value="file" ${S.config.claude.source === 'file' ? 'selected' : ''}>Arquivo do Claude Code neste aparelho</option>
</select></label>
${field('claude.credentialsFile', 'Arquivo de credenciais', 'text')}
</div>
<div class="row" style="margin-top:12px">
<label><span>Colar credenciais (conteúdo de <code>.credentials.json</code> ou só o access token)</span><textarea id="creds" placeholder='{"claudeAiOauth":{"accessToken":"…","refreshToken":"…","expiresAt":…}}' autocomplete="off" spellcheck="false"></textarea></label>
</div>
<div class="row" style="margin-top:8px"><button id="saveCreds">Salvar credenciais coladas</button></div>
</details>`;
}

function updateInfo() {
  const u = S.update;
  const when = u.date ? new Date(u.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  let t = `Versão instalada: <code>${esc(u.version)}</code>${when ? ` de ${when}` : ''}${u.branch ? `, ramo <code>${esc(u.branch)}</code>` : ''}.`;
  if (!u.supervised) return `${t} Atualização automática desligada: o servidor não foi iniciado pelo <code>scripts/run.sh</code>.`;
  t += ` Última conferência: ${ago(u.checkedAt)}.`;
  if (u.error) t += ` <span class="err">Falhou: ${esc(u.error)}</span>`;
  return t;
}

function render() {
  const ips = S.server.ips.map((ip) => `<code>http://${ip}:${S.server.port}/admin</code>`).join(' ');
  app.innerHTML = `
<header>
<div><h1>Painel S20</h1><p class="muted">${S.demo ? 'MODO DEMO: dados de exemplo. ' : ''}${ips ? `No PC, abra ${ips}` : `Porta ${S.server.port}`} · Node ${esc(S.server.node)}</p></div>
<div class="row"><a href="/">Voltar ao painel</a><button id="logout">Sair</button></div>
</header>

<section class="card"><h2>Telas</h2><p class="muted">Ordem e quais entram na rotação. A troca passa pelo preto; as três têm divisões e cantos de relógio diferentes de propósito.</p>
<div class="screens">${screensList()}</div>
<div class="grid" style="margin-top:12px">
${field('rotation.intervalSec', 'Trocar de tela a cada (s)', 'number', 'min="20" max="3600"')}
${field('rotation.tapNext', 'Toque na tela pula para a próxima', 'checkbox')}
</div>
<h2 style="margin-top:16px">GIFs</h2>
<p class="muted">Use como widget ao lado do relógio (acima, em "Ao lado do relógio") ou como tela cheia (tela "GIF" na rotação; com várias, cada passagem mostra a próxima). GIF, PNG, JPG ou WEBP até 20 MB.</p>
<div class="row" style="margin-top:8px">
<label>Adicionar GIFs (pode escolher vários)<input type="file" id="gifFile" accept="image/gif,image/png,image/jpeg,image/webp" multiple></label>
<label>Ajuste<select data-path="gif.fit">
<option value="contain" ${S.config.gif.fit === 'contain' ? 'selected' : ''}>Caber inteira (faixas pretas)</option>
<option value="cover" ${S.config.gif.fit === 'cover' ? 'selected' : ''}>Preencher a tela (corta as bordas)</option>
</select></label>
</div>
<div class="screens" style="margin-top:8px">${S.config.gif.items.map((it) => `
<div class="screen"><div class="thumb" style="display:flex;align-items:center;justify-content:center"><img src="/media/${esc(it.file)}" alt="" style="max-width:100%;max-height:100%"></div>
<div class="info"><b>${esc(it.name)}</b></div>
<div class="moves"><button data-delmedia="${esc(it.file)}">Apagar</button></div></div>`).join('') || '<p class="muted">Nenhuma imagem enviada.</p>'}</div>
<h2 style="margin-top:16px">Contadores do Claude</h2>
<p class="muted">Quais aparecem e em que ordem, na tela principal (anéis) e na tela 2 (linha). Cada anel que sai dá o espaço para a estatística.</p>
<div class="screens">${counterList()}</div>
<div class="grid" style="margin-top:8px">
${field('claudeView.showStats', 'Mostrar últimos 7 dias (tela principal)', 'checkbox')}
${field('claudeView.hideUnlimited', 'Ocultar contador sem limite no plano', 'checkbox')}
<label>À direita do card do Claude<select data-path="claudeView.gif">
<option value="" ${!S.config.claudeView.gif ? 'selected' : ''}>Nada</option>
${S.config.gif.items.length ? `<option value="*" ${S.config.claudeView.gif === '*' ? 'selected' : ''}>GIF, alternando entre todos</option>${S.config.gif.items.map((i) => `<option value="${esc(i.file)}" ${S.config.claudeView.gif === i.file ? 'selected' : ''}>GIF: ${esc(i.name)}</option>`).join('')}` : '<option disabled>GIF (envie um em GIFs, acima)</option>'}
</select></label>
</div>
<div class="grid" style="margin-top:12px">
<label>Ao lado do relógio (tela principal)<select data-path="tela1.clockExtra">
<option value="calendar" ${S.config.tela1.clockExtra === 'calendar' ? 'selected' : ''}>Calendário do mês com feriados</option>
<option value="gif" ${S.config.tela1.clockExtra === 'gif' ? 'selected' : ''} ${S.config.gif.items.length ? '' : 'disabled'}>GIF${S.config.gif.items.length ? '' : ' (envie um abaixo)'}</option>
<option value="none" ${S.config.tela1.clockExtra === 'none' ? 'selected' : ''}>Nada (relógio grande)</option>
</select></label>
${S.config.tela1.clockExtra === 'gif' && S.config.gif.items.length > 1 ? `<label>Qual GIF ao lado do relógio<select data-path="tela1.clockGif"><option value="*" ${S.config.tela1.clockGif === '*' ? 'selected' : ''}>Alternar entre todos</option>${S.config.gif.items.map((i) => `<option value="${esc(i.file)}" ${i.file === S.config.tela1.clockGif ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></label>` : ''}
</div></section>

<section class="card"><h2>Estado da coleta</h2><p class="muted">Se uma fonte falha, o painel mantém o último dado e segue funcionando.</p>
<div class="status">${statusRows()}</div></section>

<section class="card"><h2>Cidade do tempo</h2><p class="muted">Atual: ${esc(S.config.city.name)} (${S.config.city.lat.toFixed(3)}, ${S.config.city.lon.toFixed(3)}). Fonte: Open-Meteo.</p>
<form id="geo" class="row"><label>Buscar cidade<input type="text" id="geoq" placeholder="ex.: Campinas" autocomplete="off"></label><button>Buscar</button></form>
<div class="results" id="georesults"></div>
<div class="grid" style="margin-top:12px">${field('weather.intervalMin', 'Coletar a cada (min)', 'number', 'min="5" max="180"')}</div></section>

<section class="card"><h2>Claude</h2><p class="muted">Uso da sua assinatura (não é chave de API). O acesso fica guardado só no celular, serve apenas para ler o uso e é renovado sozinho.</p>${claudeInfo()}</section>

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

<section class="card"><h2>Atualização</h2><p class="muted">${updateInfo()}</p>
<div class="grid">
${field('update.enabled', 'Atualizar sozinho pelo GitHub', 'checkbox')}
${field('update.intervalMin', 'Conferir a cada (min)', 'number', 'min="1" max="1440"')}
<button id="update" ${S.update.supervised ? '' : 'disabled'}>Buscar atualização agora</button>
</div>
<form id="gitForm" class="row" style="margin-top:12px">
<label><span>Token do GitHub, para repositório privado (${S.secrets.gitToken ? 'salvo; deixe vazio para manter' : 'nenhum salvo'})</span><input type="password" id="gitToken" placeholder="github_pat_…" autocomplete="off" spellcheck="false"></label>
<button class="primary">Salvar token</button>
<button type="button" id="gitTest">Testar acesso</button>
<button type="button" id="gitClear" ${S.secrets.gitToken ? '' : 'disabled'}>Apagar</button>
</form>
<p class="muted" style="margin-top:8px">Crie em GitHub → Settings → Developer settings → Fine-grained tokens, só para este repositório, com leitura em "Contents". Fica guardado só no celular e nunca é reexibido. Salve e teste <b>antes</b> de deixar o repositório privado.</p>
</section>

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
    if (p === 'tela1.clockExtra') render();
  }));
  app.querySelectorAll('[data-screen]').forEach((el) => el.addEventListener('change', () => {
    S.config.screens[Number(el.dataset.screen)].enabled = el.checked;
    if (!S.config.screens.some((s) => s.enabled)) { S.config.screens[Number(el.dataset.screen)].enabled = true; toast('Pelo menos uma tela precisa ficar ativa.'); }
    dirty = true; render();
  }));
  document.getElementById('gifFile').addEventListener('change', guard(async (e) => {
    const files = [...e.target.files];
    for (const f of files) {
      toast(`Enviando ${f.name}…`);
      const r = await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) }, body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
      S.config.gif = j.config.gif; S.config.screens = j.config.screens;
    }
    render(); toast(files.length > 1 ? `${files.length} imagens enviadas.` : 'Imagem enviada.');
  }));
  app.querySelectorAll('[data-delmedia]').forEach((el) => el.addEventListener('click', guard(async () => {
    const r = await call('DELETE', `/api/admin/media/${el.dataset.delmedia}`);
    S.config.gif = r.config.gif; render(); toast('Imagem apagada.');
  })));
  app.querySelectorAll('[data-counter]').forEach((el) => el.addEventListener('change', () => {
    S.config.claudeView.counters[Number(el.dataset.counter)].enabled = el.checked;
    dirty = true; render();
  }));
  app.querySelectorAll('[data-cmove]').forEach((el) => el.addEventListener('click', () => {
    const [i, d] = el.dataset.cmove.split(':').map(Number);
    const a = S.config.claudeView.counters; [a[i], a[i + d]] = [a[i + d], a[i]];
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
  document.getElementById('update').addEventListener('click', guard(async (e) => {
    e.target.disabled = true; e.target.textContent = 'Conferindo…';
    const r = await call('POST', '/api/admin/update').finally(() => { e.target.disabled = false; e.target.textContent = 'Buscar atualização agora'; });
    if (!r.updated) { S.update = r.update; toast('Já está na versão mais recente.'); return render(); }
    toast('Versão nova baixada. Reiniciando o servidor…');
    setTimeout(() => location.reload(), 8000);
  }));
  document.getElementById('gitForm').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    const v = document.getElementById('gitToken').value.trim();
    if (!v) return toast('Cole o token primeiro.');
    S.secrets = (await call('PUT', '/api/admin/secrets/git', { token: v })).secrets;
    render(); toast('Token salvo. Testando…');
    await call('POST', '/api/admin/update/test'); toast('Acesso ao GitHub funcionando.');
  }));
  document.getElementById('gitTest').addEventListener('click', guard(async () => {
    toast('Testando…'); await call('POST', '/api/admin/update/test'); toast('Acesso ao GitHub funcionando.');
  }));
  document.getElementById('gitClear').addEventListener('click', guard(async () => {
    S.secrets = (await call('PUT', '/api/admin/secrets/git', { token: '' })).secrets;
    render(); toast('Token apagado.');
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
  document.getElementById('claudeLogin').addEventListener('click', guard(async () => {
    const tab = window.open('', '_blank'); // aberta já no clique, senão o navegador bloqueia
    const { url } = await call('POST', '/api/admin/claude/login').catch((e) => { tab?.close(); throw e; });
    if (tab) tab.location = url;
    document.getElementById('loginLink').href = url;
    document.getElementById('loginStep').hidden = false;
    document.getElementById('loginCode').focus();
  }));
  document.getElementById('loginFinish').addEventListener('submit', guard(async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Conectando…';
    const r = await call('POST', '/api/admin/claude/login/finish', { code: document.getElementById('loginCode').value }).finally(() => { btn.disabled = false; btn.textContent = 'Concluir'; });
    S.secrets = r.secrets; S.config.claude.source = r.config.claude.source; S.status.claude = r.status;
    render();
    toast(r.status.error ? `Conectou, mas a leitura falhou: ${r.status.error}` : 'Conta conectada. O painel já está mostrando o uso.');
  }));
  const saveCreds = (value) => guard(async () => {
    const r = await call('PUT', '/api/admin/secrets/claude', { credentials: value() });
    S.secrets = r.secrets;
    if (value()) { S.config.claude.source = 'manual'; const c = await call('PUT', '/api/admin/config', S.config); S.config = c.config; dirty = false; }
    toast(value() ? 'Credenciais salvas. Testando a leitura…' : 'Conta desconectada.');
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
boot().catch((e) => { app.innerHTML = `<div class="card login"><h1>Painel S20</h1><p class="muted">Não consegui falar com o servidor: ${esc(e.message)}</p></div>`; });
