// Faixas do índice de qualidade do ar (AQI americano, o que o Open-Meteo entrega como us_aqi;
// as faixas são parecidas com as do IQAr brasileiro). Compartilhado entre servidor e painel.
export const AQI = [
  [50, '#4ADE80', 'boa'],
  [100, '#F5D33D', 'moderada'],
  [150, '#FB8C3C', 'ruim p/ sensíveis'],
  [200, '#F87171', 'ruim'],
  [300, '#C58AF9', 'muito ruim'],
  [Infinity, '#B4535E', 'péssima'],
];
export const aqiLevel = (v) => (typeof v === 'number' ? AQI.find(([lim]) => v <= lim) : null);

// Chuva nos próximos minutos, a partir da precipitação de 15 em 15 min.
// Devolve { kind: 'starts' | 'stops', at } ou null. Considera chuva acima de 0,1 mm em 15 min
// e olha até 2 h à frente.
export function nowcast(slots, now) {
  const RAIN = 0.1;
  const next = slots.filter((s) => s.t + 15 * 60_000 > now).slice(0, 9);
  if (!next.length) return null;
  const wet = (s) => (s.mm ?? 0) > RAIN;
  const raining = wet(next[0]);
  const change = next.findIndex((s) => wet(s) !== raining);
  if (change < 0) return null;
  return { kind: raining ? 'stops' : 'starts', at: next[change].t };
}

// Texto do aviso: "chuva começa em ~30 min" / "chuva para em ~20 min" (null se já passou)
export function nowcastText(nc, now, short = false) {
  if (!nc) return null;
  const min = Math.round((nc.at - now) / 60_000 / 5) * 5;
  if (min < -10) return null;
  const when = min <= 5 ? (nc.kind === 'starts' ? 'chegando' : 'parando') : `${short ? 'em' : nc.kind === 'starts' ? 'começa em' : 'para em'} ~${min} min`;
  if (min <= 5) return `chuva ${when}`;
  return short ? `${nc.kind === 'starts' ? 'chuva' : 'para'} ${when}` : `chuva ${when}`;
}
