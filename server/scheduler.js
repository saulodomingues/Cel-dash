// Roda os coletores dos widgets, cada um no seu intervalo, com recuo quando falham.
// Uma falha nunca derruba o painel: o último dado bom fica, e o erro vai junto.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, DATA_DIR, getConfig, getSecrets, saveSecrets, writeJsonAtomic } from './config.js';
import * as history from './history.js';

const DEMO = process.env.DEMO === '1';
const collectors = new Map();
const timers = new Map();
const fails = new Map();
export const state = {}; // id -> { data, at, error, errorAt }
let onUpdate = () => {};

// Último dado bom de cada widget, salvo em disco: depois de reiniciar (atualização automática,
// queda de energia) o painel volta mostrando o que tinha, em vez de "sem dados".
const CACHE = path.join(DATA_DIR, 'cache.json');
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; } }
let saveTimer = null;
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out = {};
    for (const [id, st] of Object.entries(state)) if (st.data && st.at) out[id] = { data: st.data, at: st.at };
    try { writeJsonAtomic(CACHE, out, 0o644); } catch (e) { console.error('cache:', e.message); }
  }, 2000);
}

export async function loadCollectors() {
  const cache = DEMO ? {} : loadCache();
  const dir = path.join(ROOT, 'widgets');
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'collector.js');
    if (!fs.existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    collectors.set(mod.id, mod);
    const c = cache[mod.id];
    // só reaproveita dado de até 1 dia
    state[mod.id] = c && Date.now() - c.at < 86400_000 ? { data: c.data, at: c.at, error: null, errorAt: null } : { data: null, at: null, error: null, errorAt: null };
  }
}

const ctx = () => ({ config: getConfig(), secrets: getSecrets(), saveSecrets, history, demo: DEMO });

async function run(id) {
  clearTimeout(timers.get(id));
  const mod = collectors.get(id);
  const c = ctx();
  const base = mod.intervalMs(c.config);
  let delay = base;
  try {
    const data = DEMO && mod.demo ? mod.demo(c) : await mod.collect(c);
    state[id] = { data, at: Date.now(), error: null, errorAt: null };
    fails.set(id, 0);
    if (!DEMO) saveCache();
  } catch (e) {
    const n = (fails.get(id) || 0) + 1;
    fails.set(id, n);
    const cause = e.cause?.code ? ` (${e.cause.code})` : '';
    state[id] = { ...state[id], error: String(e.message || e) + cause, errorAt: Date.now() };
    // recuo exponencial: começa no mínimo do coletor (1 min por padrão) e dobra a cada falha, até o
    // teto do coletor (15 min por padrão; o do Claude é maior); respeita o Retry-After quando informado
    const first = mod.minRetryMs || 60_000;
    const cap = mod.maxRetryMs || 15 * 60_000;
    delay = Math.min(Math.max(cap, e.retryAfterMs || 0), Math.max(e.retryAfterMs || 0, first * 2 ** Math.min(n - 1, 6)));
    console.error(`[${id}] ${state[id].error} (nova tentativa em ${Math.round(delay / 1000)} s)`);
  }
  onUpdate(id, state[id]);
  timers.set(id, setTimeout(() => run(id), delay));
  return state[id];
}

export function start(cb) {
  onUpdate = cb;
  for (const id of collectors.keys()) run(id);
  setInterval(() => history.prune(), 6 * 3600_000).unref();
  history.prune();
}

export function refresh(id) {
  if (!collectors.has(id)) throw new Error('Widget desconhecido.');
  return run(id);
}

export const ids = () => [...collectors.keys()];
