// Testes das partes puras: normalização das respostas e contas do histórico.  node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 's20-'));
const claude = await import('../widgets/claude/collector.js');
const weather = await import('../widgets/weather/collector.js');
const { setConfig, publicConfig } = await import('../server/config.js');
const { shiftOffset, inRange } = await import('../panel/burnin.js');

const claudeAuth = await import('../widgets/claude/auth.js');
const H = 3600_000;

test('claude: login gera o endereço de autorização com PKCE e recusa código de outra tentativa', async () => {
  // vetor do RFC 7636, apêndice B
  assert.equal(claudeAuth.challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const u = new URL(claudeAuth.startLogin());
  assert.equal(u.origin + u.pathname, 'https://claude.ai/oauth/authorize');
  assert.equal(u.searchParams.get('scope'), 'user:profile');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(u.searchParams.get('state').length >= 32);
  await assert.rejects(claudeAuth.finishLogin('abc#estado-errado', { secrets: {}, saveSecrets() {} }), /outra tentativa/);
});

test('claude: normaliza a resposta e escolhe o limite por modelo', () => {
  const raw = {
    five_hour: { utilization: 62, resets_at: '2026-11-25T04:59:59+00:00' },
    seven_day: { utilization: 41, resets_at: '2026-11-28T12:00:00+00:00' },
    seven_day_oauth_apps: null,
    seven_day_opus: { utilization: 12, resets_at: null },
    seven_day_fable: { utilization: 78, resets_at: '2026-11-28T12:00:00+00:00' },
  };
  const n = claude.normalize(raw);
  assert.equal(n.session.pct, 62);
  assert.equal(n.session.resetsAt, Date.parse('2026-11-25T04:59:59Z'));
  assert.equal(n.model.key, 'seven_day_fable');
  assert.equal(n.model.label, 'Fable');
  assert.deepEqual(n.keys, ['seven_day_opus', 'seven_day_fable']);
  assert.equal(claude.normalize(raw, 'seven_day_opus').model.label, 'Opus');
});

test('claude: sem limite por modelo o anel fica sem dados, sem quebrar', () => {
  const n = claude.normalize({ five_hour: { utilization: 0, resets_at: null }, seven_day: null });
  assert.equal(n.model, null);
  assert.equal(n.week, null);
  assert.deepEqual(n.session, { pct: 0, resetsAt: null });
});

test('claude: uso diário soma os aumentos e trata a renovação semanal', () => {
  const now = new Date(2026, 10, 25, 15, 0).getTime();
  const d = (daysAgo, h) => new Date(2026, 10, 25 - daysAgo, h, 0).getTime();
  const days = claude.dailyUse([
    { t: d(2, 10), w: 80 }, { t: d(2, 20), w: 90 },   // anteontem: +10
    { t: d(1, 10), w: 5 },                             // ontem: renovou, conta 5
    { t: d(1, 22), w: 12 },                            // ontem: +7
    { t: d(0, 9), w: 20 },                             // hoje: +8
  ], now);
  assert.equal(days.length, 7);
  assert.deepEqual(days.slice(-3).map((x) => x.value), [10, 12, 8]);
});

test('claude: curva só com leituras da sessão atual', () => {
  const resetsAt = 100 * H;
  const curve = claude.sessionCurve([
    { t: 94 * H, s: 50, sr: 95 * H },          // sessão anterior
    { t: 96 * H, s: 10, sr: resetsAt },
    { t: 97 * H, s: 30, sr: resetsAt + 1000 }, // o horário de renovação oscila um pouco
  ], { pct: 30, resetsAt });
  assert.deepEqual(curve.map((p) => p.pct), [10, 30]);
});

test('tempo: normaliza a resposta do Open-Meteo', () => {
  const p = (n) => String(n).padStart(2, '0');
  const base = new Date(2026, 10, 25);
  const iso = (d) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const hourly = { time: [], temperature_2m: [], precipitation_probability: [] };
  for (let i = 0; i < 72; i++) {
    const d = new Date(base.getTime() + i * H);
    hourly.time.push(`${iso(d)}T${p(d.getHours())}:00`); hourly.temperature_2m.push(20 + (i % 24) / 4); hourly.precipitation_probability.push(i % 100);
  }
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2026, 10, 25 + i));
  const j = {
    current: { temperature_2m: 21.4, apparent_temperature: 22.1, weather_code: 61, wind_speed_10m: 12.3, is_day: 0 },
    hourly,
    daily: {
      time: days.map(iso), weather_code: [61, 2, 0, 61, 3, 1, 95],
      temperature_2m_max: [26, 27, 29, 24, 26, 28, 30], temperature_2m_min: [18, 18, 19, 17, 18, 19, 20],
      sunrise: days.map((d) => `${iso(d)}T05:12`), sunset: days.map((d) => `${iso(d)}T18:34`),
    },
  };
  const now = new Date(2026, 10, 25, 3, 20).getTime();
  const w = weather.normalize(j, { name: 'São Paulo' }, now);
  assert.equal(w.hours.length, 24);
  assert.equal(new Date(w.hours[0].t).getHours(), 3); // a hora em curso
  assert.equal(w.current.text, 'Chuva fraca');
  assert.equal(w.current.rain, 3);
  assert.equal(w.days.length, 5);
  assert.equal(w.days[0].max, 27); // amanhã
  assert.equal(new Date(w.sun.rises[0]).getHours(), 5);
});

test('config: valores fora da faixa são corrigidos e o painel não vê caminhos', () => {
  const c = setConfig({ claude: { intervalMin: 1, credentialsFile: '/x' }, pixelShift: { maxPx: 99 }, screens: [{ id: 'tela3', enabled: false }, { id: 'zzz' }], night: { start: 'abc' } });
  assert.equal(c.claude.intervalMin, 5);
  assert.equal(c.pixelShift.maxPx, 8);
  assert.deepEqual(c.screens.map((s) => s.id), ['tela3', 'tela1', 'tela2']);
  assert.equal(c.night.start, '22:00');
  assert.equal(publicConfig().claude.credentialsFile, undefined);
});

test('burn-in: pixel shift fica dentro do limite e horário noturno cruza a meia-noite', () => {
  const cfg = { intervalSec: 60, maxPx: 4 };
  const seen = new Set();
  for (let i = 0; i < 81; i++) {
    const [x, y] = shiftOffset(i * 60_000, cfg);
    assert.ok(Math.abs(x) <= 4 && Math.abs(y) <= 4);
    seen.add(`${x},${y}`);
  }
  assert.equal(seen.size, 81); // passa por todas as posições
  assert.deepEqual(shiftOffset(123456, { intervalSec: 60, maxPx: 0 }), [0, 0]);
  const at = (h, m) => new Date(2026, 10, 25, h, m).getTime();
  assert.equal(inRange(at(23, 0), '22:00', '07:00'), true);
  assert.equal(inRange(at(6, 59), '22:00', '07:00'), true);
  assert.equal(inRange(at(12, 0), '22:00', '07:00'), false);
});
