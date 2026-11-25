// Tempo: Open-Meteo, gratuito e sem chave.
export const id = 'weather';
export const intervalMs = (cfg) => cfg.weather.intervalMin * 60_000;

// Código WMO -> [descrição, ícone de dia, ícone de noite]
const WMO = {
  0: ['Céu limpo', 'sun', 'moon'], 1: ['Poucas nuvens', 'partly', 'partly-night'],
  2: ['Parcialmente nublado', 'partly', 'partly-night'], 3: ['Nublado', 'cloud', 'cloud'],
  45: ['Neblina', 'fog', 'fog'], 48: ['Neblina', 'fog', 'fog'],
  51: ['Garoa fraca', 'rain', 'rain'], 53: ['Garoa', 'rain', 'rain'], 55: ['Garoa forte', 'rain', 'rain'],
  56: ['Garoa congelante', 'rain', 'rain'], 57: ['Garoa congelante', 'rain', 'rain'],
  61: ['Chuva fraca', 'rain', 'rain'], 63: ['Chuva', 'rain', 'rain'], 65: ['Chuva forte', 'rain', 'rain'],
  66: ['Chuva congelante', 'rain', 'rain'], 67: ['Chuva congelante', 'rain', 'rain'],
  71: ['Neve fraca', 'snow', 'snow'], 73: ['Neve', 'snow', 'snow'], 75: ['Neve forte', 'snow', 'snow'], 77: ['Neve', 'snow', 'snow'],
  80: ['Pancadas fracas', 'rain', 'rain'], 81: ['Pancadas de chuva', 'rain', 'rain'], 82: ['Pancadas fortes', 'rain', 'rain'],
  85: ['Neve', 'snow', 'snow'], 86: ['Neve', 'snow', 'snow'],
  95: ['Trovoada', 'storm', 'storm'], 96: ['Trovoada com granizo', 'storm', 'storm'], 99: ['Trovoada com granizo', 'storm', 'storm'],
};
const describe = (code, isDay = true) => {
  const w = WMO[code] || ['—', 'cloud', 'cloud'];
  return { text: w[0], icon: isDay ? w[1] : w[2] };
};

// O Open-Meteo devolve horas locais da cidade ("2026-11-25T03:00"); o S20 está no mesmo fuso.
const ts = (s) => new Date(s).getTime();

export function normalize(j, city, now = Date.now()) {
  const h = j.hourly, d = j.daily, c = j.current;
  const times = h.time.map(ts);
  let i0 = times.findIndex((t) => t + 3600_000 > now);
  if (i0 < 0) i0 = 0;
  const hours = [];
  for (let i = i0; i < Math.min(i0 + 24, times.length); i++) {
    hours.push({ t: times[i], temp: h.temperature_2m[i], rain: h.precipitation_probability?.[i] ?? 0 });
  }
  const today = d.time.findIndex((s) => ts(`${s}T00:00`) + 86400_000 > now);
  const t0 = Math.max(0, today);
  const days = [];
  for (let i = t0 + 1; i < Math.min(t0 + 6, d.time.length); i++) {
    days.push({ t: ts(`${d.time[i]}T12:00`), max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], ...describe(d.weather_code[i]) });
  }
  // hoje: chance máxima de chuva, hora do pico (das horas que ainda faltam), milímetros e UV máximo
  const left = [];
  for (let i = i0; i < times.length && new Date(times[i]).toDateString() === new Date(now).toDateString(); i++) left.push(i);
  const peak = left.reduce((b, i) => ((h.precipitation_probability?.[i] ?? -1) > (h.precipitation_probability?.[b] ?? -1) ? i : b), left[0] ?? i0);
  const pick = (arr) => (Array.isArray(arr) && typeof arr[t0] === 'number' ? arr[t0] : null);
  return {
    city: city.name,
    today: {
      rainMax: pick(d.precipitation_probability_max),
      rainPeakAt: left.length && (h.precipitation_probability?.[peak] ?? 0) > 0 ? times[peak] : null,
      rainPeak: left.length ? h.precipitation_probability?.[peak] ?? null : null,
      rainMm: pick(d.precipitation_sum),
      uvMax: pick(d.uv_index_max),
    },
    current: {
      temp: c.temperature_2m, feels: c.apparent_temperature, wind: c.wind_speed_10m,
      humidity: typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : null,
      rain: hours[0]?.rain ?? null, ...describe(c.weather_code, c.is_day !== 0),
    },
    hours, days,
    sun: { rises: d.sunrise.map(ts), sets: d.sunset.map(ts) },
  };
}

export async function collect({ config }) {
  const { lat, lon } = config.city;
  const url = 'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=7&wind_speed_unit=kmh` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,relative_humidity_2m' +
    '&hourly=temperature_2m,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,uv_index_max';
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Open-Meteo respondeu ${r.status}`);
  return normalize(await r.json(), config.city);
}

// Dados de exemplo, iguais aos dos mocks (DEMO=1).
export function demo({ config }) {
  const now = Date.now();
  const hour = Math.floor(now / 3600_000) * 3600_000;
  const temps = [21, 20, 20, 19, 19, 18, 18, 19, 21, 23, 25, 26, 27, 27, 26, 25, 24, 23, 22, 21, 21, 20, 20, 19];
  const rain = [80, 70, 60, 40, 30, 20, 10, 10, 5, 5, 10, 20, 40, 60, 70, 60, 40, 30, 20, 20, 30, 40, 50, 60];
  const mid = new Date(now); mid.setHours(0, 0, 0, 0);
  const day = (i, h, m) => mid.getTime() + i * 86400_000 + (h * 60 + m) * 60_000;
  const fc = [[27, 18, 2], [29, 19, 0], [24, 17, 61], [26, 18, 3], [28, 19, 1]];
  return {
    city: config.city.name,
    current: { temp: 21, feels: 22, wind: 12, rain: 82, humidity: 78, text: 'Chuva fraca', icon: 'rain' },
    today: { rainMax: 80, rainPeak: 70, rainPeakAt: hour + 2 * 3600_000, rainMm: 6.4, uvMax: 7.2 },
    hours: temps.map((temp, i) => ({ t: hour + i * 3600_000, temp, rain: rain[i] })),
    days: fc.map(([max, min, code], i) => ({ t: day(i + 1, 12, 0), max, min, ...describe(code) })),
    sun: { rises: [0, 1, 2].map((i) => day(i, 5, 12)), sets: [0, 1, 2].map((i) => day(i, 18, 34)) },
  };
}
