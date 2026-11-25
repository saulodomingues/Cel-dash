// Mini calendário do mês, para o espaço livre do card do relógio (tela 1).
// Só visual, sem coletor: os feriados são calculados no aparelho.
import { esc } from '/panel/lib.js';
import { holidays, nextHoliday } from './holidays.shared.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// scale: tamanho relativo (1 = 112 px de largura); a proporção se mantém.
export function miniCalendar(now, accent = '#F0C98A', scale = 1) {
  const z = (n) => +(n * scale).toFixed(1);
  const d = new Date(now);
  const y = d.getFullYear(), m = d.getMonth(), today = d.getDate();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const hol = new Map(holidays(y).filter((h) => h.date.getMonth() === m).map((h) => [h.date.getDate(), h]));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<span></span>');
  for (let n = 1; n <= days; n++) {
    const dow = (first + n - 1) % 7;
    const h = hol.get(n);
    let style = `color: ${dow === 0 ? '#6B7078' : n < today ? '#5F646B' : '#C4C7CC'}`;
    if (h) style = `color: ${h.optional ? '#C58AF9' : '#F87171'}`;
    if (n === today) style = `background: ${accent}; color: #000000; border-radius: ${z(4)}px; font-weight: 600`;
    cells.push(`<span style="${style}">${n}</span>`);
  }
  const next = nextHoliday(now);
  const when = next.days === 0 ? 'hoje' : next.days === 1 ? 'amanhã' : `em ${next.days} dias`;
  return `
<div style="width: ${z(112)}px; display: flex; flex-direction: column; gap: ${z(4)}px">
<div style="font-size: ${z(10)}px; color: #9AA0A6; letter-spacing: 0.04em">${MONTHS[m]}</div>
<div style="display: grid; grid-template-columns: repeat(7, 1fr); row-gap: ${z(1)}px; text-align: center; font-size: ${z(8.5)}px; line-height: ${z(13)}px; color: #6B7078; font-family: Inter, sans-serif">
${['d', 's', 't', 'q', 'q', 's', 's'].map((l) => `<span>${l}</span>`).join('')}
${cells.join('')}
</div>
<div style="font-size: ${z(9.5)}px; color: #9AA0A6; line-height: 1.25; margin-top: ${z(2)}px"><span style="color: ${next.optional ? '#C58AF9' : '#F87171'}">●</span> ${esc(next.name)} ${when}</div>
</div>`;
}
