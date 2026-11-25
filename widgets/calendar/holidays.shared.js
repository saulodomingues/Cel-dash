// Feriados nacionais do Brasil, calculados no próprio aparelho (sem internet).
// Datas móveis a partir da Páscoa; Carnaval e Corpus Christi são ponto facultativo nacional.

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), mês 0-11.
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// [{ date: Date (meia-noite local), name, optional }]
export function holidays(year) {
  const e = easter(year);
  const list = [
    [new Date(year, 0, 1), 'Confraternização Universal'],
    [plus(e, -48), 'Carnaval', true],
    [plus(e, -47), 'Carnaval', true],
    [plus(e, -2), 'Sexta-feira Santa'],
    [new Date(year, 3, 21), 'Tiradentes'],
    [new Date(year, 4, 1), 'Dia do Trabalho'],
    [plus(e, 60), 'Corpus Christi', true],
    [new Date(year, 8, 7), 'Independência'],
    [new Date(year, 9, 12), 'Nossa Senhora Aparecida'],
    [new Date(year, 10, 2), 'Finados'],
    [new Date(year, 10, 15), 'Proclamação da República'],
    ...(year >= 2024 ? [[new Date(year, 10, 20), 'Consciência Negra']] : []),
    [new Date(year, 11, 25), 'Natal'],
  ];
  return list.map(([date, name, optional = false]) => ({ date, name, optional })).sort((x, y) => x.date - y.date);
}

// Próximo feriado (inclui hoje) e quantos dias faltam.
export function nextHoliday(now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const y = today.getFullYear();
  const h = [...holidays(y), ...holidays(y + 1)].find((x) => x.date >= today);
  return { ...h, days: Math.round((h.date - today) / 86400_000) };
}
