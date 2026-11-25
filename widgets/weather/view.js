// Tempo: card da tela 1, curva de 24 h e arco do sol da tela 2.
import { esc, hm, pad, deg, pct, num, dur, cardHead, noData, WD, SG, LABEL } from '/panel/lib.js';

const CLOUD = 'M7 17a4 4 0 0 1 .6-7.95A5.5 5.5 0 0 1 18 10.5a3.3 3.3 0 0 1-.5 6.5z';
const SMALL_CLOUD = 'M9.5 20a3.4 3.4 0 0 1 .5-6.76A4.7 4.7 0 0 1 18.9 15.4 2.8 2.8 0 0 1 18.5 20z';
const ICONS = {
  sun: ['#F5A524', '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/>'],
  moon: ['#C4C7CC', '<path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"/>'],
  partly: ['#C4C7CC', `<g stroke="#F5A524"><path d="M9 3v1.5M3.7 5.2l1.1 1.1M2 10.5h1.5M14.3 5.2l-1.1 1.1"/><path d="M5.8 12.3A3.6 3.6 0 1 1 12.4 9"/></g><path d="${SMALL_CLOUD}"/>`],
  'partly-night': ['#C4C7CC', `<path d="M13.5 8.2A5 5 0 0 1 7.3 3a4.6 4.6 0 0 0-1.6 8.6" stroke="#9AA0A6"/><path d="${SMALL_CLOUD}"/>`],
  cloud: ['#C4C7CC', `<path d="${CLOUD}"/>`],
  fog: ['#C4C7CC', `<path d="${CLOUD}"/><path d="M6 20h12M9 22.5h7"/>`],
  rain: ['#8AB4F8', `<path d="${CLOUD}"/><path d="M9 20l-.6 1.5M13 20l-.6 1.5M17 20l-.6 1.5"/>`],
  storm: ['#8AB4F8', `<path d="${CLOUD}"/><path d="M13 18.5l-2 2.5h3l-2 2.5" stroke="#F5A524"/>`],
  snow: ['#C4C7CC', `<path d="${CLOUD}"/><path d="M9 20.8h.01M13 20.8h.01M17 20.8h.01" stroke-width="2"/>`],
};

export function icon(name, size = 44) {
  const [color, body] = ICONS[name] || ICONS.cloud;
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// Tela 1: atual + 5 dias.
export function weatherCard(w, now, chip = '#14161A') {
  const head = cardHead('Tempo', w, now);
  const d = w?.data;
  if (!d) return head + noData();
  const c = d.current;
  return `${head}
<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
<div style="display: flex; align-items: center; gap: 12px">
${icon(c.icon)}
<div>
<div style="${SG}; font-size: 44px; line-height: 1; font-weight: 500">${deg(c.temp)}</div>
<div style="font-size: 12px; color: #C4C7CC; margin-top: 4px; white-space: nowrap">${esc(c.text)}</div>
</div>
</div>
<div style="display: grid; grid-template-columns: auto auto; column-gap: 12px; row-gap: 4px; font-size: 12px; color: #9AA0A6">
<span>Sensação</span><span style="color: #E8EAED; text-align: right">${deg(c.feels)}</span>
<span>Chuva</span><span style="color: #E8EAED; text-align: right">${pct(c.rain)}</span>
<span>Vento</span><span style="color: #E8EAED; text-align: right">${num(c.wind)} km/h</span>
</div>
</div>
<div style="margin-top: auto; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; font-size: 11px; color: #9AA0A6; text-align: center">
${d.days.slice(0, 5).map((x) => `<div style="background: ${chip}; border-radius: 8px; padding: 6px 0">${WD[new Date(x.t).getDay()]}<div style="color: #E8EAED; font-size: 13px; margin-top: 2px">${deg(x.max)} <span style="color: #9AA0A6">${deg(x.min)}</span></div></div>`).join('\n')}
</div>`;
}

// Curva suave passando por todos os pontos (Catmull-Rom convertida em Bézier).
function smooth(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// Tela 2: temperatura das próximas 24 h, com chance de chuva em barras.
export function chart24(w) {
  const d = w?.data;
  const city = d?.city ? ` · ${esc(d.city)}` : '';
  if (!d || d.hours.length < 2) {
    return `<div style="display: flex; justify-content: space-between; ${LABEL}; padding: 0 12px"><span>Próximas 24 h${city}</span><span>sem dados</span></div>${noData()}`;
  }
  const hs = d.hours;
  const temps = hs.map((h) => h.temp);
  const max = Math.max(...temps), min = Math.min(...temps);
  const X0 = 24, X1 = 732, YT = 28, YB = 108;
  const x = (i) => X0 + ((X1 - X0) * i) / (hs.length - 1);
  const y = (t) => (max === min ? (YT + YB) / 2 : YB - ((t - min) / (max - min)) * (YB - YT));
  const pts = hs.map((h, i) => [x(i), y(h.temp)]);
  const line = smooth(pts);
  const txt = (px, py, s, fill, font, size) => `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="middle" fill="${fill}" font-family="${font}" font-size="${size}">${s}</text>`;
  let marks = '', labels = '', bars = '';
  hs.forEach((h, i) => {
    const r = Math.max(0, Math.min(100, h.rain || 0));
    const bh = Math.max(1.3, r * 0.26);
    bars += `<rect x="${(x(i) - 6).toFixed(1)}" y="${(148 - bh).toFixed(1)}" width="12" height="${bh.toFixed(1)}" rx="2" fill="#8AB4F8" fill-opacity="${(0.25 + 0.006 * r).toFixed(2)}"/>`;
    if (i % 3 !== 0) return;
    marks += txt(x(i), y(h.temp) - 10, deg(h.temp), '#E8EAED', "'Space Grotesk', sans-serif", 13) +
      `<circle cx="${x(i).toFixed(1)}" cy="${y(h.temp).toFixed(1)}" r="2.5" fill="#000000" stroke="#F5A524" stroke-width="1.5"/>`;
    labels += txt(x(i), 168, i === 0 ? 'agora' : `${pad(new Date(h.t).getHours())}h`, '#9AA0A6', 'Inter, sans-serif', 11);
  });
  return `
<div style="display: flex; justify-content: space-between; ${LABEL}; padding: 0 12px"><span>Próximas 24 h${city}</span><span>máx ${deg(max)} · mín ${deg(min)} · chuva em azul</span></div>
<svg role="img" aria-label="Temperatura e chance de chuva nas próximas 24 horas" width="756" height="180" viewBox="0 0 756 180">
<path d="${line} L${X1}.0 118 L${X0}.0 118 Z" fill="#F5A524" fill-opacity="0.07"/>
<path d="${line}" fill="none" stroke="#F5A524" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
${marks}
${bars}
${labels}
</svg>`;
}

// Tela 2: arco do sol.
export function sunArc(w, now) {
  const s = w?.data?.sun;
  const rise = s?.rises.find((t) => new Date(t).toDateString() === new Date(now).toDateString());
  const set = s?.sets.find((t) => new Date(t).toDateString() === new Date(now).toDateString());
  const nextRise = s?.rises.find((t) => t > now);
  const up = rise && set && now >= rise && now < set;
  let cx = 15, cy = 60, fill = '#000000', text = 'sem dados';
  if (up) {
    const f = (now - rise) / (set - rise);
    cx = 95 - 80 * Math.cos(Math.PI * f); cy = 60 - 52 * Math.sin(Math.PI * f); fill = '#F5A524';
    text = `sol se põe em ${dur(set - now, true)}`;
  } else if (nextRise) {
    text = `sol nasce em ${dur(nextRise - now, true)}`;
  }
  return `
<svg role="img" aria-label="Arco do sol" width="190" height="70" viewBox="0 0 190 70">
<path d="M15 60 A80 52 0 0 1 175 60" fill="none" stroke="#3A3D44" stroke-width="1.5" stroke-dasharray="3 5" stroke-linecap="round"/>
<path d="M4 60 H186" stroke="#2A2D33" stroke-width="1"/>
<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${fill}" stroke="#F5A524" stroke-width="1.5"/>
</svg>
<div style="display: flex; justify-content: space-between; font-size: 11px; color: #9AA0A6"><span>nasce ${rise ? hm(rise) : '—'}</span><span>põe ${set ? hm(set) : '—'}</span></div>
<div style="font-size: 12px; color: #C4C7CC">${text}</div>`;
}

// Tela 2, no lugar da linha do Claude: chuva hoje, umidade e índice UV, com barras finas.
const UV = [[3, '#4ADE80', 'baixo'], [6, '#F5D33D', 'moderado'], [8, '#FB8C3C', 'alto'], [11, '#F87171', 'muito alto'], [Infinity, '#C58AF9', 'extremo']];
export function todayStats(w) {
  const d = w?.data;
  const t = d?.today || {};
  const hum = d?.current?.humidity;
  const uv = typeof t.uvMax === 'number' ? t.uvMax : null;
  const uvCat = uv === null ? null : UV.find(([lim]) => uv < lim);
  const rain = typeof t.rainMax === 'number' ? t.rainMax : null;
  const rainSub = rain === null ? '' : [
    t.rainPeakAt && t.rainPeak >= 20 ? `pico às ${pad(new Date(t.rainPeakAt).getHours())}h` : rain < 20 ? 'pouca chance' : 'já passou o pico',
    typeof t.rainMm === 'number' && t.rainMm >= 0.1 ? `${num(t.rainMm, 1)} mm` : '',
  ].filter(Boolean).join(' · ');
  const item = (label, value, pctBar, color, sub) => `
<div style="flex: 1; min-width: 0">
<div style="display: flex; justify-content: space-between; align-items: baseline"><span style="font-size: 11px; color: #9AA0A6">${label}</span><span style="${SG}; font-size: 20px; font-weight: 500; color: #C4C7CC">${value}</span></div>
<div style="height: 3px; border-radius: 2px; background: #1C1E22; margin-top: 4px"><div style="width: ${pctBar === null ? 0 : Math.max(0, Math.min(100, pctBar))}%; height: 3px; border-radius: 2px; background: ${color}"></div></div>
<div style="font-size: 10px; color: #6B7078; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${sub || '&nbsp;'}</div>
</div>`;
  return `
<div style="${LABEL}">Hoje${d ? '' : ' · sem dados'}</div>
<div style="display: flex; gap: 16px">
${item('Chuva', rain === null ? '—' : pct(rain), rain, '#8AB4F8', rainSub)}
${item('Umidade', typeof hum === 'number' ? pct(hum) : '—', hum ?? null, '#8AB4F8', typeof hum === 'number' ? (hum >= 80 ? 'abafado' : hum <= 30 ? 'ar seco' : '') : '')}
${item('UV máx', uv === null ? '—' : num(uv, 0), uv === null ? null : (uv / 11) * 100, uvCat ? uvCat[1] : '#1C1E22', uvCat ? uvCat[2] : '')}
</div>`;
}
