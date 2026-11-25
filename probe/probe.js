// Sonda de validação no S20: rode `npm run probe` no Termux antes de confiar no painel.
// Testa cada fonte de dados isoladamente e diz o que funcionou. Não grava nada além de
// data/probe-usage.json (a resposta bruta do endpoint de uso, sem o token).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA_DIR, getConfig, getSecrets, saveSecrets } from '../server/config.js';
import * as weather from '../widgets/weather/collector.js';
import * as claude from '../widgets/claude/collector.js';
import { tcpPing } from '../widgets/system/collector.js';

const ok = (m) => console.log(`  ok     ${m}`);
const bad = (m) => console.log(`  FALHOU ${m}`);
const config = getConfig();

console.log(`\nNode ${process.version} em ${process.platform}/${process.arch}`);
if (Number(process.versions.node.split('.')[0]) < 20) bad('precisa de Node 20 ou mais novo'); else ok('versão do Node');

console.log('\nTermux:API');
for (const cmd of ['termux-battery-status', 'termux-wifi-connectioninfo']) {
  try {
    const j = JSON.parse(execFileSync(cmd, { timeout: 8000, encoding: 'utf8' }));
    ok(`${cmd}: ${JSON.stringify(j).slice(0, 110)}`);
  } catch (e) { bad(`${cmd}: ${e.code === 'ENOENT' ? 'não instalado (pkg install termux-api + app Termux:API)' : e.message.split('\n')[0]}`); }
}

console.log('\nRede');
const ms = await tcpPing(config.system.pingHost, config.system.pingPort);
if (ms === null) bad(`sem conexão com ${config.system.pingHost}:${config.system.pingPort}`); else ok(`latência até ${config.system.pingHost}: ${ms} ms`);

console.log('\nTempo (Open-Meteo)');
try {
  const w = await weather.collect({ config });
  ok(`${w.city}: ${w.current.temp}°, ${w.current.text}; ${w.hours.length} horas e ${w.days.length} dias de previsão`);
} catch (e) { bad(e.message); }

console.log('\nUso do Claude (OAuth)');
try {
  const raw = await claude.fetchUsage({ config, secrets: getSecrets(), saveSecrets });
  fs.writeFileSync(path.join(DATA_DIR, 'probe-usage.json'), JSON.stringify(raw, null, 2));
  const n = claude.normalize(raw, config.claude.modelKey);
  ok(`sessão de 5 h: ${n.session ? n.session.pct + '%' : 'ausente'}`);
  ok(`semana (todos os modelos): ${n.week ? n.week.pct + '%' : 'ausente'}`);
  console.log(`         limites por modelo na resposta: ${n.keys.join(', ') || 'nenhum'}`);
  if (n.model) ok(`anel do meio usará ${n.model.key} (${n.model.pct}%)`);
  else bad('nenhum limite semanal por modelo utilizável: o anel do Fable ficará sem dados');
  console.log(`         resposta bruta salva em ${path.join(DATA_DIR, 'probe-usage.json')}`);
} catch (e) { bad(e.message); }

console.log('\nTela: abra http://localhost:' + config.port + '/probe no Fully Kiosk com o servidor rodando.\n');
