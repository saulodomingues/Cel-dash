// Tela 1, principal: relógio e tempo em cima, Claude embaixo. Única com cards.
import { clockCard, statusBadge } from '/widgets/clock/view.js';
import { weatherCard } from '/widgets/weather/view.js';
import { claudeCard } from '/widgets/claude/view.js';
import { clockMood, skyMood } from '/panel/mood.js';
import { miniCalendar } from '/widgets/calendar/view.js';
import { gifWidget } from '/widgets/gif/view.js';
import { quotesWidget } from '/widgets/quotes/view.js';
import { tickerBar, mountTicker } from '/widgets/news/ticker.view.js';

const CARD = 'background: #0D0E10; border: 1px solid #1C1E22; border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column';

export const mount = mountTicker;

export function tela1({ data, config, now, visit = 0 }) {
  const clk = clockMood(now, data.weather);
  const sky = skyMood(data.weather?.data?.current?.icon);
  // letreiro "AGORA" opcional no rodapé (manchetes da tela de manchetes); some sem manchetes
  const ticker = config.news?.ticker ? tickerBar(data.news?.data?.items, config.news.crawl) : '';
  return `
<div style="width: 780px; height: 360px; box-sizing: border-box; padding: 12px 12px ${ticker ? 6 : 12}px; background: #000000; color: #E8EAED; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)${ticker ? ' 22px' : ''}; gap: 4px">
<section style="grid-column: span 2; ${CARD}; background: ${clk.bg}; border-color: ${clk.border}; justify-content: space-between">${clockCard(now, config.city.name, clk.digits, config.tela1?.clockExtra === 'calendar' ? miniCalendar(now, clk.digits, 1.2) : config.tela1?.clockExtra === 'quotes' ? quotesWidget(data.quotes, now) : config.tela1?.clockExtra === 'gif' ? gifWidget(config, config.tela1.clockGif, { width: 120, visit }) : '')}</section>
<section style="grid-column: span 2; ${CARD}; background: ${sky.bg}; border-color: ${sky.border}; gap: ${ticker ? 3 : 6}px${ticker ? '; padding-top: 10px; padding-bottom: 10px' : ''}">${weatherCard(data.weather, now, sky.chip, Boolean(ticker))}</section>
<section style="grid-column: span 4; ${CARD}; gap: 10px">${claudeCard(data.claude, now, config.claude.planLabel, config.claudeView, config.claudeView?.gif ? gifWidget(config, config.claudeView.gif, { width: 124, visit: visit + 1 }) : '', statusBadge(data.system))}</section>
${ticker}
</div>`;
}
