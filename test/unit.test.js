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
  assert.equal(u.origin + u.pathname, 'https://claude.com/cai/oauth/authorize');
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
  assert.equal(n.model.pct, 78);
  assert.equal(claude.normalize(raw, 'seven_day_opus').model.label, 'Opus');
});

test('claude: sem limite por modelo o anel fica sem dados, sem quebrar', () => {
  const n = claude.normalize({ five_hour: { utilization: 0, resets_at: null }, seven_day: null });
  assert.equal(n.model, null);
  assert.equal(n.week, null);
  assert.deepEqual(n.session, { pct: 0, resetsAt: null });
});

test('claude: formato atual com lista "limits" (Fable) e plano sem limite de 5 h', () => {
  const raw = {
    five_hour: null,
    seven_day: { utilization: 51, resets_at: '2026-11-30T13:00:00Z' },
    limits: [
      { kind: 'weekly_all', group: 'weekly', percent: 51, resets_at: '2026-11-30T13:00:00Z' },
      { kind: 'weekly_scoped', group: 'weekly', percent: 4, resets_at: '2026-11-30T13:00:00Z', scope: { model: { display_name: 'Fable' } } },
    ],
  };
  const n = claude.normalize(raw);
  assert.equal(n.session.unlimited, true);
  assert.equal(n.week.pct, 51);
  assert.equal(n.model.label, 'Fable');
  assert.equal(n.model.pct, 4);
  assert.equal(n.model.resetsAt, Date.parse('2026-11-30T13:00:00Z'));
  assert.deepEqual(n.keys, ['limit:Fable']);
  // só a lista, sem os campos antigos, e reset em segundos
  const m = claude.normalize({ limits: [{ kind: 'session', percent: 20, resets_at: 1764500000 }, { kind: 'weekly_all', utilization: 30, resets_at: null }] });
  assert.deepEqual(m.session, { pct: 20, resetsAt: 1764500000000 });
  assert.equal(m.week.pct, 30);
  assert.equal(m.model, null);
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

test('claude: resposta real de uma conta Ultra (25/11/2026)', () => {
  const raw = {
    five_hour: null,
    seven_day: { utilization: 51, resets_at: '2026-11-30T13:00:00.342639+00:00', limit_dollars: null },
    seven_day_oauth_apps: null, seven_day_opus: null, seven_day_sonnet: null, seven_day_cowork: null, seven_day_omelette: null,
    limits: [
      { kind: 'weekly_all', group: 'weekly', percent: 51, severity: 'normal', resets_at: '2026-11-30T13:00:00.342639+00:00', scope: null, is_active: true },
      { kind: 'weekly_scoped', group: 'weekly', percent: 4, severity: 'normal', resets_at: '2026-11-30T13:00:00.342782+00:00', scope: { model: { id: null, display_name: 'Fable' }, surface: null }, is_active: false },
    ],
  };
  const n = claude.normalize(raw);
  assert.equal(n.session.unlimited, true);
  assert.equal(n.week.pct, 51);
  assert.equal(n.model.label, 'Fable');
  assert.equal(n.model.pct, 4);
  assert.deepEqual(n.keys, ['limit:Fable']);
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
    current: { temperature_2m: 21.4, apparent_temperature: 22.1, weather_code: 61, wind_speed_10m: 12.3, is_day: 0, relative_humidity_2m: 81 },
    hourly,
    daily: {
      time: days.map(iso), weather_code: [61, 2, 0, 61, 3, 1, 95],
      temperature_2m_max: [26, 27, 29, 24, 26, 28, 30], temperature_2m_min: [18, 18, 19, 17, 18, 19, 20],
      sunrise: days.map((d) => `${iso(d)}T05:12`), sunset: days.map((d) => `${iso(d)}T18:34`),
      precipitation_probability_max: [70, 10, 0, 90, 20, 5, 60], precipitation_sum: [4.2, 0, 0, 12, 1, 0, 3], uv_index_max: [7.4, 9, 10, 3, 6, 8, 5],
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
  assert.equal(w.current.humidity, 81);
  assert.deepEqual([w.today.rainMax, w.today.rainMm, w.today.uvMax], [70, 4.2, 7.4]);
  assert.equal(new Date(w.today.rainPeakAt).getHours(), 23); // maior chance nas horas que faltam de hoje (prob. = i % 100)
});

test('config: valores fora da faixa são corrigidos e o painel não vê caminhos', () => {
  const c = setConfig({ claude: { intervalMin: 1, credentialsFile: '/x' }, pixelShift: { maxPx: 99 }, screens: [{ id: 'tela3', enabled: false }, { id: 'zzz' }], night: { start: 'abc' } });
  assert.equal(c.claude.intervalMin, 5);
  assert.equal(c.pixelShift.maxPx, 8);
  assert.deepEqual(c.screens.map((s) => s.id), ['tela3', 'tela1', 'tela2', 'news', 'gif']);
  assert.equal(c.screens.find((s) => s.id === 'gif').enabled, false);
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

test('cor: ritmo de uso vira laranja se estoura antes de renovar, vermelho perto do limite', async () => {
  const { usageMood, runOut, WEEK_MS } = await import('../panel/mood.js');
  const now = Date.UTC(2026, 10, 25, 13, 0);
  const resetsAt = Date.UTC(2026, 10, 30, 13, 0); // 2 dias corridos de 7
  assert.equal(usageMood({ pct: 51, resetsAt }, '#8AB4F8', WEEK_MS, now).color, '#FB8C3C'); // 51% em 2 dias: acaba antes
  assert.match(usageMood({ pct: 51, resetsAt }, '#8AB4F8', WEEK_MS, now).note, /^acaba (hoje|dom|seg|ter|qua|qui|sex|sáb) \d{1,2}h$/);
  assert.equal(usageMood({ pct: 4, resetsAt }, '#C58AF9', WEEK_MS, now).color, '#C58AF9');
  assert.equal(usageMood({ pct: 92, resetsAt: now + 3600_000 }, '#8AB4F8', WEEK_MS, now).color, '#F87171');
  assert.equal(usageMood({ pct: 30, resetsAt, severity: 'critical' }, '#8AB4F8', WEEK_MS, now).color, '#F87171');
  // começo da janela (menos de 10%): não projeta
  assert.equal(runOut({ pct: 20, resetsAt: now + WEEK_MS - 3600_000 }, WEEK_MS, now), null);
  assert.equal(usageMood({ pct: null, unlimited: true }, '#F5A524', WEEK_MS, now).color, '#F5A524');
});

test('calendário: Páscoa e feriados nacionais calculados no aparelho', async () => {
  const { easter, holidays, nextHoliday } = await import('../widgets/calendar/holidays.shared.js');
  const ymd = (d) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
  assert.equal(ymd(easter(2026)), '2026-4-5');
  assert.equal(ymd(easter(2027)), '2027-3-28');
  const h26 = holidays(2026);
  assert.equal(ymd(h26.find((h) => h.name === 'Sexta-feira Santa').date), '2026-4-3');
  assert.equal(ymd(h26.find((h) => h.name === 'Corpus Christi').date), '2026-6-4');
  assert.deepEqual(h26.filter((h) => h.name === 'Carnaval').map((h) => ymd(h.date)), ['2026-2-16', '2026-2-17']);
  assert.ok(h26.some((h) => h.name === 'Consciência Negra'));
  const n = nextHoliday(new Date(2026, 10, 25, 13).getTime());
  assert.equal(n.name, 'Natal'); assert.equal(n.days, 30);
  assert.equal(nextHoliday(new Date(2026, 11, 31, 9).getTime()).name, 'Confraternização Universal'); // vira o ano
  assert.equal(nextHoliday(new Date(2026, 8, 7, 23, 58).getTime()).days, 0);
});

test('brilho pelo Termux: dia, noite e horário de apagar', async () => {
  const { target } = await import('../server/display.js');
  const cfg = { brightness: { day: 35, night: 8 }, night: { start: '22:00', end: '07:00' }, sleep: { enabled: true, start: '00:30', end: '06:30' } };
  const at = (h, m) => new Date(2026, 10, 25, h, m).getTime();
  assert.equal(target(at(14, 0), cfg), Math.round(0.35 * 255));
  assert.equal(target(at(23, 0), cfg), Math.round(0.08 * 255));
  assert.equal(target(at(3, 0), cfg), 0);
  assert.equal(target(at(3, 0), { ...cfg, sleep: { ...cfg.sleep, enabled: false } }), Math.round(0.08 * 255));
});

test('cotações: leitura da AwesomeAPI e do Yahoo, e valores curtos', async () => {
  const q = await import('../widgets/quotes/collector.js');
  const { CATALOG, fmtQuote } = await import('../widgets/quotes/catalog.shared.js');
  const pick = (...ids) => ids.map((id) => CATALOG.find((c) => c.id === id));
  const aw = q.parseAwesome({
    USDBRL: { code: 'USD', codein: 'BRL', bid: '5.4213', pctChange: '0.21', timestamp: '1764072000' },
    BTCUSD: { code: 'BTC', codein: 'USD', bid: '98412.5', pctChange: '-1.3', timestamp: '1764072000' },
  }, pick('USD', 'BTC', 'EUR'));
  assert.equal(aw.USD.value, 5.4213); assert.equal(aw.USD.pct, 0.21); assert.equal(aw.USD.at, 1764072000000);
  assert.equal(aw.BTC.pct, -1.3);
  assert.equal(aw.EUR, undefined); // não veio: fica de fora
  const y = q.parseYahoo({ chart: { result: [{ meta: { regularMarketPrice: 131200.5, chartPreviousClose: 132000, regularMarketTime: 1764072000 } }], error: null } });
  assert.equal(y.value, 131200.5); assert.ok(y.pct < 0);
  assert.equal(q.parseYahoo({ chart: { result: null, error: { code: 'Not Found' } } }), null);
  assert.equal(fmtQuote(5.4213, 'fx'), '5,42');
  assert.equal(fmtQuote(98412.5, 'crypto'), '98,4 mil');
  assert.equal(fmtQuote(3410, 'crypto'), '3,41 mil');
  assert.equal(fmtQuote(6012.3, 'index'), '6.012');
  assert.equal(fmtQuote(131200.5, 'index'), '131,2 mil');
  assert.equal(fmtQuote(0.0054, 'fx'), '0,0054');
});

test('alerta de chuva e qualidade do ar', async () => {
  const { nowcast, nowcastText, aqiLevel } = await import('../widgets/weather/air.shared.js');
  const { parseAir } = await import('../widgets/weather/collector.js');
  const t0 = Date.UTC(2026, 10, 25, 18, 0), Q = 15 * 60_000;
  const slots = (mm) => mm.map((v, i) => ({ t: t0 + i * Q, mm: v }));
  const now = t0 + 5 * 60_000;
  const a = nowcast(slots([0, 0, 0.4, 1.2, 0]), now);
  assert.deepEqual(a, { kind: 'starts', at: t0 + 2 * Q });
  assert.equal(nowcastText(a, now), 'chuva começa em ~25 min');
  assert.equal(nowcastText(a, now, true), 'chuva em ~25 min');
  const b = nowcast(slots([0.8, 0.5, 0, 0]), now);
  assert.equal(b.kind, 'stops');
  assert.equal(nowcastText(b, now, true), 'para em ~25 min'); // primeiro intervalo seco começa em t0+30
  assert.equal(nowcast(slots([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), now), null); // sem chuva: sem aviso
  assert.equal(nowcastText({ kind: 'starts', at: now + 2 * 60_000 }, now), 'chuva chegando');
  assert.equal(nowcastText({ kind: 'starts', at: now - 20 * 60_000 }, now), null); // já passou
  assert.equal(aqiLevel(38)[2], 'boa'); assert.equal(aqiLevel(120)[2], 'ruim p/ sensíveis'); assert.equal(aqiLevel(null), null);
  assert.deepEqual(parseAir({ current: { us_aqi: 37.6, pm2_5: 9.2 } }), { aqi: 38, pm25: 9.2 });
  assert.equal(parseAir(null), null);
});

test('manchetes: lê RSS e Atom, decodifica, filtra e mistura as fontes', async () => {
  const n = await import('../widgets/news/collector.js');
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss><channel><title>Site</title>
<item><title><![CDATA[Frente fria chega &amp; derruba temperaturas]]></title><link>https://x/1</link>
<pubDate>Wed, 25 Nov 2026 20:00:00 -0300</pubDate><description>&lt;p&gt;Chuva forte no &lt;b&gt;sábado&lt;/b&gt;.&lt;/p&gt;</description></item>
<item><title>Notícia do BBB 30</title><pubDate>Wed, 25 Nov 2026 19:00:00 -0300</pubDate></item>
<item><title>Notícia velha</title><pubDate>Mon, 23 Nov 2026 10:00:00 -0300</pubDate></item>
</channel></rss>`;
  const a = n.parseFeed(rss, 'Site A');
  assert.equal(a.length, 3);
  assert.equal(a[0].title, 'Frente fria chega & derruba temperaturas');
  assert.equal(a[0].summary, 'Chuva forte no sábado.');
  assert.equal(a[0].t, Date.parse('2026-11-25T23:00:00Z'));
  const atom = `<feed><entry><title type="html">Atualização do &#8220;Galaxy&#8221;</title><updated>2026-11-25T22:30:00Z</updated><summary>Resumo</summary></entry></feed>`;
  const b = n.parseFeed(atom, 'Site B');
  assert.equal(b[0].title, 'Atualização do “Galaxy”');
  const latin = new Uint8Array(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><rss><item><title>Ação</title></item></rss>', 'latin1'));
  assert.equal(n.parseFeed(n.bytesToText(latin), 'F')[0].title, 'Ação');
  const now = Date.parse('2026-11-26T00:00:00Z');
  const out = n.mix([a, b, [{ title: 'frente fria chega & derruba temperaturas!', t: now - 60_000, source: 'Dup' }]], { blockWords: ['bbb'], maxAgeHours: 12, maxItems: 10 }, now);
  assert.ok(!out.some((x) => /BBB/.test(x.title)));            // palavra bloqueada
  assert.ok(!out.some((x) => x.title === 'Notícia velha'));      // mais antiga que 12 h
  assert.equal(out.filter((x) => /frente fria/i.test(x.title)).length, 1); // duplicada entre fontes
  assert.deepEqual(out.map((x) => x.source), ['Site A', 'Site B']); // mais recente primeiro; a cópia de outra fonte sai
});
