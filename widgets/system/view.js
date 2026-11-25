// Saúde do S22: lista da coluna esquerda e latência (tela 3).
import { esc, num, deg, LABEL, SG } from '/panel/lib.js';

const row = (label, value) => `<div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px"><span style="color: #9AA0A6">${esc(label)}</span><span style="color: #E8EAED; ${SG}; font-size: 15px; white-space: nowrap">${value}</span></div>`;
const dot = (color) => `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${color}; margin-right: 6px; vertical-align: 2px"></span>`;

function uptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export function systemList(w) {
  const d = w?.data;
  const head = `<div style="${LABEL}">Sistema · S22${d ? '' : ' · sem dados'}</div>`;
  if (!d) return head;
  const bat = d.battery ? `${Math.round(d.battery.pct)}%${d.chargeLimit ? ` · limite ${d.chargeLimit}%` : ''}` : '—';
  // somado ao que passou desde a coleta, para não ficar parado entre atualizações
  const up = d.uptimeSec + Math.max(0, Math.round((Date.now() - w.at) / 1000));
  return `${head}
${row('Bateria', bat)}
${row('Temperatura', d.battery ? deg(d.battery.temp) : '—')}
${row('Servidor no ar', uptime(up))}
${row('Memória livre', `${num(d.memFree / 1024 ** 3, 1)} GB`)}
${row('Wi-Fi', d.wifi ? `−${Math.abs(d.wifi.rssi)} dBm` : '—')}
${d.vpn ? row(d.vpn.label, d.vpn.online ? `${dot('#4ADE80')}online` : `${dot('#F5A524')}fora do ar`) : ''}`;
}

export function latencyChart(w) {
  const lat = w?.data?.latency;
  const ok = (lat?.samples || []).filter((s) => typeof s.ms === 'number');
  const last = lat ? (lat.last === null ? 'sem resposta' : `${lat.last} ms`) : '—';
  let path = '';
  if (ok.length >= 2) {
    const t1 = ok[ok.length - 1].t, t0 = Math.min(ok[0].t, t1 - 60_000);
    const max = Math.max(60, ...ok.map((s) => s.ms)); // escala mínima de 60 ms: jitter pequeno fica plano
    path = ok.map((s, i) => `${i ? 'L' : 'M'}${(4 + ((s.t - t0) / (t1 - t0)) * 498).toFixed(1)} ${(40 - (s.ms / max) * 34).toFixed(1)}`).join(' ');
  }
  return `
<div style="display: flex; justify-content: space-between; align-items: baseline; ${LABEL}"><span>Internet · latência na última hora</span><span style="${SG}; font-size: 15px; color: #C4C7CC; letter-spacing: 0">${last}</span></div>
<svg role="img" aria-label="Latência da internet na última hora" width="506" height="44" viewBox="0 0 506 44">
${path ? `<path d="${path}" fill="none" stroke="#8AB4F8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` : '<path d="M4 40 H502" stroke="#1C1E22" stroke-width="1"/>'}
</svg>`;
}
