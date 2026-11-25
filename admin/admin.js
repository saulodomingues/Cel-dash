import { FEEDS as NEWS_FEEDS } from '/widgets/news/catalog.shared.js';
import { CATALOG as QUOTES, MAX_QUOTES as MAX_Q } from '/widgets/quotes/catalog.shared.js';
// /admin: telas e configurações. Funciona no navegador do PC e no próprio celular.
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SCREEN_NAMES = { tela1: ['Principal', 'Relógio, tempo e uso do Claude'], tela2: ['Tempo em detalhe', 'Próximas 24 h, sol, chuva, umidade e UV'], tela3: ['Saúde do sistema', 'S20, curva da sessão e latência'], gif: ['GIF', 'Só a imagem animada, em tela cheia. Envie abaixo.'], news: ['Manchetes', 'Notícias passando sozinhas. Configure em Manchetes, abaixo.'] };
const WIDGET_NAMES = { weather: 'Tempo', claude: 'Uso do Claude', system: 'Sistema do S20', quotes: 'Cotações', news: 'Manchetes' };
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

// ---------- GIFs ----------
// Envio com progresso, um arquivo por vez. Um arquivo com erro não impede os outros;
// o resultado de cada um fica na tela até o próximo envio.
const MEDIA_MAX = 20 * 1024 * 1024;
let uploads = []; // [{ name, size, pct, state: 'fila'|'enviando'|'ok'|'erro', error }]

function sendFile(f, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/admin/media');
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.setRequestHeader('X-File-Name', encodeURIComponent(f.name));
    x.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(ev.loaded / ev.total); };
    x.onload = () => {
      let j = {}; try { j = JSON.parse(x.responseText); } catch { /* resposta vazia */ }
      if (x.status === 401) { boot(); return reject(new Error('Sessão expirada. Entre de novo.')); }
      if (x.status >= 200 && x.status < 300) resolve(j); else reject(new Error(j.error || `Erro ${x.status}`));
    };
    x.onerror = () => reject(new Error('A conexão com o celular caiu durante o envio.'));
    x.ontimeout = () => reject(new Error('O envio demorou demais.'));
    x.timeout = 10 * 60_000;
    x.send(f);
  });
}

function uploadsHtml() {
  if (!uploads.length) return '';
  const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  return `<div class="uploads">${uploads.map((u) => `
<div class="up ${u.state}"><div class="upline"><span class="upname">${esc(u.name)}</span><span class="upstate">${
  u.state === 'fila' ? 'na fila' : u.state === 'enviando' ? `${Math.round(u.pct * 100)}%` : u.state === 'ok' ? 'adicionado ✓' : 'falhou'} · ${kb(u.size)}</span></div>
<div class="upbar"><div style="width:${u.state === 'ok' ? 100 : Math.round(u.pct * 100)}%"></div></div>
${u.error ? `<div class="err">${esc(u.error)}</div>` : ''}</div>`).join('')}</div>`;
}
function paintUploads() { const el = document.getElementById('uploads'); if (el) el.innerHTML = uploadsHtml(); }

async function uploadGifs(files) {
  if (!files.length) return;
  uploads = files.map((f) => ({ name: f.name, size: f.size, pct: 0, state: 'fila', error: f.size > MEDIA_MAX ? 'Maior que 20 MB.' : null }));
  uploads.forEach((u) => { if (u.error) u.state = 'erro'; });
  paintUploads();
  const input = document.getElementById('gifFile'); input.disabled = true;
  for (let i = 0; i < files.length; i++) {
    const u = uploads[i];
    if (u.state === 'erro') continue;
    u.state = 'enviando'; paintUploads();
    try {
      const j = await sendFile(files[i], (p) => { u.pct = p; paintUploads(); });
      S.config.gif = j.config.gif; u.state = 'ok';
    } catch (err) { u.state = 'erro'; u.error = err.message; }
    paintUploads();
  }
  const ok = uploads.filter((u) => u.state === 'ok').length, bad = uploads.length - ok;
  render(); // galeria com os novos
  toast(bad ? `${ok} adicionado(s), ${bad} com erro. Veja a lista.` : ok > 1 ? `${ok} GIFs adicionados.` : 'GIF adicionado.');
}
// Onde cada GIF aparece: valor da escolha = '' (não mostrar), '*' (alternar entre todos) ou o arquivo.
function gifSpots() {
  const c = S.config;
  return {
    clock: c.tela1.clockExtra === 'gif' ? c.tela1.clockGif : '',
    claude: c.claudeView.gif || '',
  };
}
function gifPlaceSelect(id, label, value) {
  const items = S.config.gif.items;
  return `<label>${label}<select id="${id}" ${items.length ? '' : 'disabled'}>
<option value="" ${!value ? 'selected' : ''}>Não mostrar</option>
${items.length > 1 ? `<option value="*" ${value === '*' ? 'selected' : ''}>Alternar entre todos</option>` : ''}
${items.map((i) => `<option value="${esc(i.file)}" ${value === i.file || (value === '*' && items.length === 1) ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
</select></label>`;
}
function gifSection() {
  const items = S.config.gif.items;
  const spots = gifSpots();
  return `
<section class="card"><h2>GIFs</h2>
<p class="muted">Sua coleção de GIFs, salva no celular. Escolha onde aparecem em "Onde mostrar", abaixo, ou com o botão direito em cada GIF (no celular, segure o dedo). Aceita GIF, PNG, JPG ou WEBP, até 20 MB cada.</p>
<div class="row"><label>Adicionar GIFs (pode escolher vários de uma vez)<input type="file" id="gifFile" accept="image/gif,image/png,image/jpeg,image/webp" multiple></label></div>
<div id="uploads">${uploadsHtml()}</div>
<div class="gallery">${items.map((it) => `
<figure class="gif" data-gif="${esc(it.file)}" title="Botão direito (ou segurar no celular): onde mostrar">
<div class="gifthumb"><img src="/media/${esc(it.file)}" alt="${esc(it.name)}"></div>
<figcaption><span class="gifname">${esc(it.name)}</span></figcaption>
<button data-delmedia="${esc(it.file)}" aria-label="Apagar ${esc(it.name)}">Apagar</button>
</figure>`).join('') || '<p class="muted">Nenhum GIF ainda. Adicione acima.</p>'}</div>
<h2 style="margin-top:16px">Onde mostrar</h2>
<div class="grid">
${gifPlaceSelect('gifClock', 'Ao lado do relógio (no lugar do calendário)', spots.clock)}
${gifPlaceSelect('gifClaude', 'Ao lado do gráfico do Claude (direita)', spots.claude)}
<label>Tela cheia (liga e desliga em Telas, acima)<select id="gifFullPick" ${items.length ? '' : 'disabled'}>
${items.length > 1 ? `<option value="*" ${S.config.gif.full === '*' ? 'selected' : ''}>Alternar entre todos</option>` : ''}
${items.map((i) => `<option value="${esc(i.file)}" ${S.config.gif.full === i.file || (items.length === 1) ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}
</select></label>
<label>Ajuste na tela cheia<select data-path="gif.fit">
<option value="contain" ${S.config.gif.fit === 'contain' ? 'selected' : ''}>Caber inteiro (faixas pretas)</option>
<option value="cover" ${S.config.gif.fit === 'cover' ? 'selected' : ''}>Preencher a tela (corta as bordas)</option>
</select></label>
</div>
<p class="muted" style="margin-top:8px">"Alternar entre todos" mostra o próximo GIF a cada vez que a tela volta na rotação. Depois de escolher, clique em Salvar e aplicar.</p>
</section>`;
}

// ---------- manchetes ----------
function newsSection() {
  const n = S.config.news;
  const errs = S.status.news?.data?.errors || {};
  const errList = Object.entries(errs);
  return `
<section class="card"><h2>Manchetes</h2>
<p class="muted">Tela de notícias que passam sozinhas (liga e desliga em Telas, acima) e letreiro "AGORA" opcional no rodapé da tela principal. As manchetes vêm dos feeds públicos (RSS) dos sites.</p>
<div class="grid" style="margin-bottom:8px">${field('news.ticker', 'Mostrar letreiro "AGORA" na tela principal', 'checkbox')}</div>
<div class="muted" style="margin-bottom:4px">Fontes</div>
<div class="qgrid">${NEWS_FEEDS.map((f) => `<label class="check"><input type="checkbox" data-feed="${f.id}" ${n.feeds.includes(f.id) ? 'checked' : ''}>${esc(f.name)}</label>`).join('')}</div>
<div class="row" style="margin-top:8px"><label><span>Outros feeds (um endereço por linha)</span><textarea id="newsCustom" placeholder="https://site.com.br/feed/" spellcheck="false" style="min-height:60px">${esc(n.custom.join('\n'))}</textarea></label></div>
${errList.length ? `<p class="err" style="margin-top:8px">Fontes com erro: ${errList.map(([k, v]) => `${esc(k)} (${esc(v)})`).join(' · ')}</p>` : ''}
<div class="grid" style="margin-top:12px">
${field('news.seconds', 'Cada manchete fica (s)', 'number', 'min="5" max="60"')}
<label>Velocidade do letreiro<select data-path="news.crawl">${[['lenta', 'Lenta'], ['normal', 'Normal'], ['rapida', 'Rápida']].map(([v, t]) => `<option value="${v}" ${n.crawl === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
${field('news.intervalMin', 'Buscar notícias a cada (min)', 'number', 'min="5" max="120"')}
${field('news.maxAgeHours', 'Mostrar notícias de até (horas)', 'number', 'min="1" max="72"')}
${field('news.maxItems', 'Quantas manchetes na fila', 'number', 'min="3" max="40"')}
<label><span>Esconder notícias com as palavras (separe por vírgula)</span><input type="text" id="newsBlock" value="${esc(n.blockWords.join(', '))}" placeholder="ex.: BBB, horóscopo"></label>
</div>
</section>`;
}

// ---------- cotações ----------
function quotesPicker() {
  const sel = S.config.quotes.items;
  const groups = [['fx', 'Moedas (em R$)'], ['crypto', 'Cripto (em US$)'], ['index', 'Bolsas (uns 15 min de atraso)']];
  return `</div><div style="margin-top:12px"><p class="muted">Cotações ao lado do relógio: escolha até ${MAX_Q} (${sel.length} escolhidas). Aparecem na ordem desta lista.</p>
${groups.map(([k, t]) => `<div style="margin-top:8px"><div class="muted">${t}</div><div class="qgrid">${QUOTES.filter((q) => q.kind === k).map((q) => `
<label class="check"><input type="checkbox" data-quote="${q.id}" ${sel.includes(q.id) ? 'checked' : ''} ${!sel.includes(q.id) && sel.length >= MAX_Q ? 'disabled' : ''}>${esc(q.name)}</label>`).join('')}</div></div>`).join('')}
${S.status.quotes?.data?.errors?.length ? `<p class="err" style="margin-top:8px">${esc(S.status.quotes.data.errors.join(' · '))}</p>` : ''}
</div><div class="grid" style="margin-top:12px">
${field('quotes.intervalMin', 'Atualizar cotações a cada (min)', 'number', 'min="2" max="120"')}`;
}

const COUNTER_NAMES = { session: ['Sessão de 5 h', 'some sozinho em plano sem esse limite'], model: ['Semana do modelo', 'Fable, ou o escolhido em Claude'], week: ['Semana, todos modelos', ''] };
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

function apiInfo() {
  const e = S.status.system?.data?.apiErrors || {};
  const names = { 'termux-battery-status': 'bateria', 'termux-wifi-connectioninfo': 'Wi-Fi' };
  const list = Object.entries(e);
  if (!list.length) return '';
  return `<p class="err" style="margin-bottom:12px">Termux:API: ${list.map(([k, v]) => `${names[k] || k}: ${esc(v)}`).join(' · ')}. Depois de corrigir, clique em "Coletar agora" em Sistema do S20 (Estado da coleta). O Wi-Fi precisa da permissão de <b>Localização</b> para o app Termux:API e da localização ligada.</p>`;
}

function displayInfo() {
  const d = S.display || {};
  if (d.error) return `<span class="err">Brilho pelo Termux: ${esc(d.error)}</span> Se for permissão: Configurações do Android → Apps → Termux:API → "Modificar configurações do sistema" → permitir.`;
  if (d.level === null || d.level === undefined) return 'Brilho pelo Termux: aguardando a primeira aplicação.';
  return `Brilho pelo Termux: <b style="font-weight:500">${Math.round((d.level / 255) * 100)}%</b> agora (${ago(d.at)}).`;
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
<h2 style="margin-top:16px">Contadores do Claude</h2>
<p class="muted">Quais aparecem e em que ordem, na tela principal. Cada anel que sai dá o espaço para a estatística.</p>
<div class="screens">${counterList()}</div>
<div class="grid" style="margin-top:8px">
${field('claudeView.showStats', 'Mostrar últimos 7 dias (tela principal)', 'checkbox')}
${field('claudeView.hideUnlimited', 'Ocultar contador sem limite no plano', 'checkbox')}

</div>
<div class="grid" style="margin-top:12px">
<label>Ao lado do relógio (tela principal)<select data-path="tela1.clockExtra">
<option value="calendar" ${S.config.tela1.clockExtra === 'calendar' ? 'selected' : ''}>Calendário do mês com feriados</option>
<option value="quotes" ${S.config.tela1.clockExtra === 'quotes' ? 'selected' : ''}>Cotações (moedas, cripto e bolsas)</option>
${S.config.tela1.clockExtra === 'gif' ? '<option value="gif" selected>GIF (escolhido na seção GIFs)</option>' : ''}
<option value="none" ${S.config.tela1.clockExtra === 'none' ? 'selected' : ''}>Nada (relógio grande)</option>
</select></label>
${S.config.tela1.clockExtra === 'quotes' ? quotesPicker() : ''}
</div></section>

${gifSection()}

${newsSection()}

<section class="card"><h2>Estado da coleta</h2><p class="muted">Se uma fonte falha, o painel mantém o último dado e segue funcionando.</p>
<div class="status">${statusRows()}</div></section>

<section class="card"><h2>Cidade do tempo</h2><p class="muted">Atual: ${esc(S.config.city.name)} (${S.config.city.lat.toFixed(3)}, ${S.config.city.lon.toFixed(3)}). Fonte: Open-Meteo.</p>
<form id="geo" class="row"><label>Buscar cidade<input type="text" id="geoq" placeholder="ex.: Campinas" autocomplete="off"></label><button>Buscar</button></form>
<div class="results" id="georesults"></div>
<div class="grid" style="margin-top:12px">${field('weather.intervalMin', 'Coletar a cada (min)', 'number', 'min="5" max="180"')}</div></section>

<section class="card"><h2>Claude</h2><p class="muted">Uso da sua assinatura (não é chave de API). O acesso fica guardado só no celular, serve apenas para ler o uso e é renovado sozinho.</p>${claudeInfo()}</section>

<section class="card"><h2>Brilho e descanso da tela</h2>
<div class="grid">
<label>Navegador do painel no celular<select data-path="display.browser">
<option value="chrome" ${S.config.display.browser === 'chrome' ? 'selected' : ''}>Chrome (app na tela inicial)</option>
<option value="fully" ${S.config.display.browser === 'fully' ? 'selected' : ''}>Fully Kiosk Browser</option>
</select></label>
</div>
<p class="muted" style="margin:8px 0 12px">${S.config.display.browser === 'fully'
    ? 'Fully: brilho, apagar a tela e detecção de movimento pela interface JavaScript dele (ligue em Advanced Web Settings). A tela ociosa usa a detecção de movimento.'
    : `Chrome: o brilho é ajustado pelo Termux e, no horário de apagar, o painel fica preto (no AMOLED, pixel preto fica desligado). Sem detecção de movimento, não há tela ociosa.`}</p>
${S.config.display.browser === 'chrome' ? `<div class="row" style="margin-bottom:12px"><span class="muted" style="flex:1 1 300px">${displayInfo()}</span><button id="testBright">Testar brilho (máximo por 3 s)</button></div>
<p class="muted" style="margin-bottom:12px">Para o brilho mudar: dê ao app <b>Termux:API</b> a permissão "Modificar configurações do sistema" (Configurações → Apps → Termux:API) e desligue o <b>brilho adaptável</b> do Android, que desfaz o ajuste. O horário de apagar só vale com "Apagar a tela em horário fixo" marcado, abaixo.</p>` : ''}
<div class="grid">
${field('brightness.day', 'Brilho de dia (%)', 'number', 'min="1" max="100"')}
${field('brightness.night', 'Brilho à noite (%)', 'number', 'min="1" max="100"')}
${field('night.start', 'Noite começa', 'time')}
${field('night.end', 'Noite termina', 'time')}
${field('sleep.enabled', 'Apagar a tela em horário fixo', 'checkbox')}
${field('sleep.start', 'Apagar às', 'time')}
${field('sleep.end', 'Acender às', 'time')}
${S.config.display.browser === 'fully' ? `${field('idle.enabled', 'Tela ociosa sem movimento', 'checkbox')}
${field('idle.afterMin', 'Ociosa após (min sem movimento)', 'number', 'min="1" max="720"')}
${field('idle.offAfterMin', 'Apagar após mais (min; 0 = nunca)', 'number', 'min="0" max="720"')}` : ''}
${field('pixelShift.intervalSec', 'Pixel shift a cada (s)', 'number', 'min="10" max="3600"')}
${field('pixelShift.maxPx', 'Deslocamento máximo (px)', 'number', 'min="0" max="8"')}
</div></section>

<section class="card"><h2>Sistema</h2><p class="muted">Bateria e Wi-Fi vêm do Termux:API. O limite de carga é só o número exibido; quem limita é a proteção de bateria do Android.</p>
${apiInfo()}
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
    if (p === 'tela1.clockExtra' || p === 'display.browser') render();
  }));
  app.querySelectorAll('[data-screen]').forEach((el) => el.addEventListener('change', () => {
    S.config.screens[Number(el.dataset.screen)].enabled = el.checked;
    if (!S.config.screens.some((s) => s.enabled)) { S.config.screens[Number(el.dataset.screen)].enabled = true; toast('Pelo menos uma tela precisa ficar ativa.'); }
    dirty = true; render();
  }));
  document.getElementById('gifFile').addEventListener('change', (e) => uploadGifs([...e.target.files]));
  const setClockGif = (v) => {
    if (v) { S.config.tela1.clockExtra = 'gif'; S.config.tela1.clockGif = v; }
    else if (S.config.tela1.clockExtra === 'gif') S.config.tela1.clockExtra = 'calendar';
  };
  const markDirty = () => { dirty = true; render(); };
  // Menu do botão direito em cada GIF da galeria (no celular: segurar o dedo).
  app.querySelectorAll('.gif[data-gif]').forEach((fig) => {
    fig.addEventListener('contextmenu', (e) => { e.preventDefault(); gifMenu(fig.dataset.gif, e.clientX, e.clientY); });
    let hold;
    fig.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      hold = setTimeout(() => gifMenu(fig.dataset.gif, e.clientX, e.clientY), 550);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointermove']) fig.addEventListener(ev, () => clearTimeout(hold));
  });
  function gifMenu(file, x, y) {
    closeMenu();
    const c = S.config;
    const onClock = c.tela1.clockExtra === 'gif' && c.tela1.clockGif === file;
    const onClaude = c.claudeView.gif === file;
    const onFull = c.gif.full === file;
    const name = c.gif.items.find((i) => i.file === file)?.name || '';
    const item = (act, label, on) => `<button role="menuitemcheckbox" aria-checked="${on}" data-act="${act}"><span class="tick">${on ? '✓' : ''}</span>${label}</button>`;
    const m = document.createElement('div');
    m.className = 'ctxmenu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<div class="ctxtitle">${esc(name)}</div>
${item('clock', 'Ao lado do relógio', onClock)}
${item('claude', 'Ao lado do gráfico do Claude', onClaude)}
${item('full', 'Na tela cheia', onFull)}
<hr>
<button role="menuitem" data-act="del" class="danger"><span class="tick"></span>Apagar</button>`;
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
    m.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
    m.querySelector('button').focus();
    m.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      closeMenu();
      if (act === 'del') return app.querySelector(`[data-delmedia="${CSS.escape(file)}"]`)?.click();
      // marcar de novo o que já está marcado desliga (relógio volta ao calendário; tela cheia volta a alternar)
      if (act === 'clock') setClockGif(onClock ? '' : file);
      if (act === 'claude') c.claudeView.gif = onClaude ? '' : file;
      if (act === 'full') c.gif.full = onFull ? '*' : file;
      markDirty();
      toast('Escolhido. Falta clicar em Salvar e aplicar.');
    });
  }

  document.getElementById('gifClock').addEventListener('change', (e) => { setClockGif(e.target.value); markDirty(); });
  document.getElementById('gifClaude').addEventListener('change', (e) => { S.config.claudeView.gif = e.target.value; markDirty(); });
  document.getElementById('gifFullPick').addEventListener('change', (e) => { S.config.gif.full = e.target.value; markDirty(); });
  app.querySelectorAll('[data-delmedia]').forEach((el) => el.addEventListener('click', guard(async () => {
    if (!confirm('Apagar este GIF do celular?')) return;
    const r = await call('DELETE', `/api/admin/media/${el.dataset.delmedia}`);
    S.config.gif = r.config.gif; S.config.tela1 = r.config.tela1; S.config.claudeView.gif = r.config.claudeView.gif;
    render(); toast('GIF apagado.');
  })));
  app.querySelectorAll('[data-feed]').forEach((el) => el.addEventListener('change', () => {
    const set = new Set(S.config.news.feeds);
    if (el.checked) set.add(el.dataset.feed); else set.delete(el.dataset.feed);
    S.config.news.feeds = NEWS_FEEDS.map((f) => f.id).filter((id) => set.has(id));
    dirty = true; document.getElementById('save').disabled = false;
  }));
  document.getElementById('newsCustom').addEventListener('change', (e) => {
    S.config.news.custom = e.target.value.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    dirty = true; document.getElementById('save').disabled = false;
  });
  document.getElementById('newsBlock').addEventListener('change', (e) => {
    S.config.news.blockWords = e.target.value.split(',').map((w) => w.trim()).filter(Boolean);
    dirty = true; document.getElementById('save').disabled = false;
  });
  app.querySelectorAll('[data-quote]').forEach((el) => el.addEventListener('change', () => {
    const order = QUOTES.map((q) => q.id);
    const set = new Set(S.config.quotes.items);
    if (el.checked) set.add(el.dataset.quote); else set.delete(el.dataset.quote);
    S.config.quotes.items = order.filter((id) => set.has(id)).slice(0, MAX_Q);
    dirty = true; render();
  }));
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
  document.getElementById('testBright')?.addEventListener('click', guard(async (e) => {
    e.target.disabled = true;
    try {
      const r = await call('POST', '/api/admin/display/test');
      S.display = r.display;
      toast('Brilho no máximo por 3 s. Se a tela do celular não clareou, veja o aviso acima.');
    } finally { e.target.disabled = false; }
    setTimeout(guard(load), 4000);
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

function closeMenu() { document.querySelectorAll('.ctxmenu').forEach((m) => m.remove()); }
addEventListener('pointerdown', (e) => { if (!e.target.closest('.ctxmenu')) closeMenu(); }, true);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
addEventListener('scroll', closeMenu, true);
addEventListener('resize', closeMenu);
addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
boot().catch((e) => { app.innerHTML = `<div class="card login"><h1>Painel S20</h1><p class="muted">Não consegui falar com o servidor: ${esc(e.message)}</p></div>`; });
