// Histórico local em NDJSON, um arquivo por dia: data/history/<nome>-AAAA-MM-DD.ndjson
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

const DIR = path.join(DATA_DIR, 'history');
fs.mkdirSync(DIR, { recursive: true });
const KEEP_DAYS = 30;

export function dayKey(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function append(name, obj) {
  fs.appendFileSync(path.join(DIR, `${name}-${dayKey(obj.t)}.ndjson`), JSON.stringify(obj) + '\n');
}

// Leituras dos últimos `days` dias (inclui hoje), em ordem cronológica.
export function read(name, days, now = Date.now()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const file = path.join(DIR, `${name}-${dayKey(now - i * 86400000)}.ndjson`);
    let txt;
    try { txt = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of txt.split('\n')) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch { /* linha cortada por queda de energia */ }
    }
  }
  return out;
}

export function prune(now = Date.now()) {
  const limit = dayKey(now - KEEP_DAYS * 86400000);
  for (const f of fs.readdirSync(DIR)) {
    const m = /-(\d{4}-\d{2}-\d{2})\.ndjson$/.exec(f);
    if (m && m[1] < limit) fs.rmSync(path.join(DIR, f), { force: true });
  }
}
