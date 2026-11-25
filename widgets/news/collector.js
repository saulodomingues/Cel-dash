// Manchetes de feeds RSS/Atom. Parser próprio e simples (sem dependências): título, link, data,
// resumo e fonte. Um feed com erro fica de fora; os outros seguem. Só busca se a tela de
// manchetes ou o letreiro da tela principal estiver ligado.
import { FEEDS } from './catalog.shared.js';

export const id = 'news';
export const intervalMs = (cfg) => cfg.news.intervalMin * 60_000;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»' };
export function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')                           // HTML dentro do resumo
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1') // espaço deixado pelas tags antes da pontuação
    .trim();
}
// HTML escapado dentro do XML (ex.: &lt;p&gt;) vira tag depois do primeiro decode: decodifica de novo
const clean = (s) => decode(decode(s));

const tag = (xml, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return m ? m[1] : '';
};

export function parseFeed(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = clean(tag(b, 'title'));
    if (!title) continue;
    const when = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const t = Date.parse(decode(when)) || null;
    let summary = clean(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    if (summary.length > 480) summary = `${summary.slice(0, 477).replace(/\s+\S*$/, '')}…`; // até ~4 linhas na tela
    if (summary === title) summary = '';
    items.push({ title, summary, t, source });
  }
  return items;
}

// Lê o corpo com a codificação certa. Alguns feeds (ex.: UOL) vêm em ISO-8859-1 sem dizer isso
// direito no XML. Ordem: o que o XML declara, o que o cabeçalho HTTP diz, e por fim confere se
// é UTF-8 válido; se não for, lê como Latin-1/Windows-1252.
export function bytesToText(buf, contentType = '') {
  const head = Buffer.from(buf.slice(0, 200)).toString('latin1');
  const declared = (/encoding=["']([\w-]+)["']/i.exec(head)?.[1] || /charset=([\w-]+)/i.exec(contentType)?.[1] || '').toLowerCase();
  const latin = () => { try { return new TextDecoder('windows-1252').decode(buf); } catch { return Buffer.from(buf).toString('latin1'); } };
  if (declared && !/^utf-?8$/.test(declared)) {
    if (/^(iso-8859-1|latin1|windows-1252|cp1252|us-ascii)$/.test(declared)) return latin();
    try { return new TextDecoder(declared).decode(buf); } catch { /* codificação que este Node não conhece: tenta as outras */ }
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return latin(); }
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

export function mix(lists, cfg, now = Date.now()) {
  const block = cfg.blockWords.map(norm).filter(Boolean);
  const seen = new Set();
  const all = [];
  for (const list of lists) {
    list.forEach((it, i) => {
      const key = norm(it.title);
      if (seen.has(key) || block.some((w) => key.includes(w))) return;
      if (it.t && now - it.t > cfg.maxAgeHours * 3600_000) return;
      seen.add(key);
      all.push({ ...it, order: i });
    });
  }
  // mais recentes primeiro; sem data vai depois, na ordem do feed
  all.sort((a, b) => (b.t || 0) - (a.t || 0) || a.order - b.order);
  // alterna as fontes no começo da fila, para não abrir com 5 manchetes do mesmo site
  const out = [];
  const bySrc = new Map();
  for (const it of all) { if (!bySrc.has(it.source)) bySrc.set(it.source, []); bySrc.get(it.source).push(it); }
  while (out.length < Math.min(cfg.maxItems, all.length)) {
    for (const q of bySrc.values()) if (q.length && out.length < cfg.maxItems) out.push(q.shift());
  }
  return out.map(({ order, ...it }) => it);
}

export async function collect({ config }) {
  if (!config.news.ticker && !config.screens.some((s) => s.id === 'news' && s.enabled)) return { items: [], idle: true };
  const n = config.news;
  const feeds = [
    ...FEEDS.filter((f) => n.feeds.includes(f.id)),
    ...n.custom.map((url) => ({ id: url, name: new URL(url).hostname.replace(/^www\./, ''), url })),
  ];
  const errors = {};
  const lists = await Promise.all(feeds.map(async (f) => {
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) monitor-mesa', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`respondeu ${r.status}`);
      const items = parseFeed(bytesToText(new Uint8Array(await r.arrayBuffer()), r.headers.get('content-type') || ''), f.name);
      if (!items.length) throw new Error('nenhuma manchete no feed');
      return items;
    } catch (e) {
      errors[f.name] = e.cause?.code || e.message;
      return [];
    }
  }));
  const items = mix(lists, n);
  if (!items.length && feeds.length) throw new Error(Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'nenhuma manchete');
  return { items, errors, sources: feeds.length - Object.keys(errors).length };
}

// Dados de exemplo (DEMO=1): manchetes inventadas.
export function demo() {
  const now = Date.now();
  const ex = [
    ['g1', 12, 'Frente fria chega a São Paulo no fim de semana e derruba as temperaturas em até 10 graus', 'Previsão indica chuva forte no sábado à tarde e mínima de 12 °C no domingo na capital.'],
    ['Folha', 20, 'Câmara aprova projeto que muda regras do vale-refeição; texto segue para o Senado', 'Proposta limita taxas cobradas de restaurantes e permite a portabilidade do benefício.'],
    ['Tecnoblog', 35, 'Samsung libera atualização de segurança de novembro para a linha Galaxy S20', 'Pacote corrige falhas no Bluetooth e chega primeiro aos aparelhos desbloqueados.'],
    ['BBC Brasil', 48, 'Cientistas registram a maior floração de corais em uma década no Pacífico', ''],
    ['Agência Brasil', 60, 'Inscrições para o programa de bolsas terminam na sexta-feira', 'Estudantes podem se inscrever pelo site do programa até as 23h59.'],
  ];
  return { items: ex.map(([source, min, title, summary]) => ({ source, title, summary, t: now - min * 60_000 })), errors: {}, sources: 5 };
}
