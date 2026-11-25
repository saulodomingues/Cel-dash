// Tela 1, principal: relógio e tempo em cima, Claude embaixo. Única com cards.
import { clockCard } from '/widgets/clock/view.js';
import { weatherCard } from '/widgets/weather/view.js';
import { claudeCard } from '/widgets/claude/view.js';
import { clockMood, skyMood } from '/panel/mood.js';
import { miniCalendar } from '/widgets/calendar/view.js';

const CARD = 'background: #0D0E10; border: 1px solid #1C1E22; border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column';

export function tela1({ data, config, now }) {
  const clk = clockMood(now, data.weather);
  const sky = skyMood(data.weather?.data?.current?.icon);
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 12px; background: #000000; color: #E8EAED; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 8px">
<section style="grid-column: span 2; ${CARD}; background: ${clk.bg}; border-color: ${clk.border}; justify-content: space-between">${clockCard(now, config.city.name, data.system, clk.digits, config.tela1?.clockExtra === 'calendar' ? miniCalendar(now, clk.digits) : '')}</section>
<section style="grid-column: span 2; ${CARD}; background: ${sky.bg}; border-color: ${sky.border}; gap: 6px">${weatherCard(data.weather, now, sky.chip)}</section>
<section style="grid-column: span 4; ${CARD}; gap: 10px">${claudeCard(data.claude, now, config.claude.planLabel)}</section>
</div>`;
}
