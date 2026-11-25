// Saúde do S20: Termux:API (bateria, Wi-Fi), /proc, e testes de rede feitos pelo próprio Node.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';

export const id = 'system';
export const intervalMs = (cfg) => cfg.system.intervalSec * 1000;

const samples = []; // latência: uma amostra por coleta, última hora

// Comando do Termux:API. Cada falha por falta de permissão faz o Android mostrar um aviso por
// cima do painel; por isso, depois de uma falha, o comando fica 30 min sem ser chamado.
const pausedUntil = new Map();
export const apiErrors = {}; // cmd -> mensagem, mostrada no /admin
function termux(cmd) {
  if (Date.now() < (pausedUntil.get(cmd) || 0)) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(cmd, [], { timeout: 8000 }, (err, stdout) => {
      let j = null;
      if (!err) { try { j = JSON.parse(stdout); } catch { /* saída vazia */ } }
      // o Termux:API responde {"API_ERROR": "..."} quando falta permissão
      if (err || !j || j.API_ERROR) {
        pausedUntil.set(cmd, Date.now() + 30 * 60_000);
        apiErrors[cmd] = err?.code === 'ENOENT' ? 'Termux:API não instalado' : j?.API_ERROR || (err?.killed ? 'o app Termux:API não respondeu' : 'sem permissão ou sem resposta');
        return resolve(null); // campo fica "—"
      }
      delete apiErrors[cmd];
      resolve(j);
    });
  });
}
export function retryApi() { pausedUntil.clear(); }

// Tempo de abertura de uma conexão TCP, em ms; null se não conectar.
export function tcpPing(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const s = net.connect({ host, port });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(timeout, () => done(null));
    s.once('connect', () => done(Math.round(Number(process.hrtime.bigint() - t0) / 1e6)));
    s.once('error', () => done(null));
  });
}

function memAvailable() {
  try {
    const m = /MemAvailable:\s+(\d+) kB/.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
    if (m) return Number(m[1]) * 1024;
  } catch { /* fora do Linux */ }
  return os.freemem();
}

function localIp(wifi) {
  if (wifi?.ip && wifi.ip !== '0.0.0.0') return wifi.ip;
  try {
    const all = Object.values(os.networkInterfaces()).flat();
    return all.find((i) => i && i.family === 'IPv4' && !i.internal)?.address || null;
  } catch { return null; }
}

export async function collect({ config }) {
  const sys = config.system;
  const [battery, wifi, ms, vpnMs] = await Promise.all([
    termux('termux-battery-status'),
    termux('termux-wifi-connectioninfo'),
    tcpPing(sys.pingHost, sys.pingPort),
    sys.vpn.host ? tcpPing(sys.vpn.host, sys.vpn.port) : null,
  ]);
  const now = Date.now();
  samples.push({ t: now, ms });
  while (samples.length && samples[0].t < now - 3600_000) samples.shift();
  return {
    battery: battery ? { pct: battery.percentage, temp: battery.temperature, charging: battery.status === 'CHARGING' || battery.plugged !== 'UNPLUGGED' } : null,
    chargeLimit: sys.chargeLimit || null,
    uptimeSec: Math.round(process.uptime()),
    memFree: memAvailable(),
    wifi: wifi && typeof wifi.rssi === 'number' && wifi.rssi < 0 ? { rssi: wifi.rssi, ssid: wifi.ssid || null } : null,
    ip: localIp(wifi),
    online: ms !== null,
    vpn: sys.vpn.host ? { label: sys.vpn.label, online: vpnMs !== null } : null,
    latency: { last: ms, samples: [...samples] },
    apiErrors: { ...apiErrors },
  };
}

// Dados de exemplo, iguais aos dos mocks (DEMO=1).
export function demo({ config }) {
  const now = Date.now();
  const ys = [18, 19, 17, 18, 22, 18, 17, 19, 18, 35, 21, 18, 17, 18, 19, 18, 20, 18, 17, 18, 24, 18, 18, 19, 17, 18, 18, 20, 19, 18];
  return {
    battery: { pct: 80, temp: 31, charging: true },
    chargeLimit: config.system.chargeLimit || 80,
    uptimeSec: 6 * 86400 + 4 * 3600,
    memFree: 3.1 * 1024 ** 3,
    wifi: { rssi: -52, ssid: 'casa' },
    ip: '192.168.0.42',
    online: true,
    vpn: { label: config.system.vpn.label, online: true },
    latency: { last: 18, samples: ys.map((ms, i) => ({ t: now - (ys.length - 1 - i) * 120_000, ms })) },
  };
}
