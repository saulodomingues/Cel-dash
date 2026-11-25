# Monitor de mesa no Galaxy S20

Briefing do projeto. O planejamento foi feito com o Saulo em 24/11/2026; a v1 foi implementada em 25/11/2026 (ver "Estado atual"). Instalação e uso estão no `README.md`.

## Estado atual

Implementado e testado só no PC (modo demo, `npm test`, navegador de 780×360). **Nada foi rodado no S20 ainda.**

- Servidor Node sem dependências (`server/`), SSE em `/events` no lugar do WebSocket proposto.
- Coletores e componentes visuais em `widgets/` (tempo, claude, system; clock só tem visual).
- As três telas reproduzem os mocks; tela ociosa feita sem mock (relógio cinza que muda de lugar).
- `/admin`: senha, ordem e ativação das telas, todas as configurações, credenciais do Claude. O construtor com grade de arrastar e soltar **não** foi feito: a v1 só ordena e liga/desliga as três telas.
- Claude via OAuth da assinatura: botão "Entrar com a conta Claude" no `/admin` (fluxo PKCE do Claude Code, escopo `user:profile`, código colado de volta); renova o token sozinho. Colar credenciais ou ler `~/.claude/.credentials.json` ficaram em "Opções avançadas". O login real não foi testado.
- Atualização automática: `server/updater.js` faz `git pull` a cada 5 min e sai; `scripts/run.sh` sobe de novo; o painel recarrega ao ver a versão mudar. O S20 segue o ramo que clonou.
- O limite semanal por modelo é detectado na resposta (`seven_day_<modelo>`); se não houver o do Fable, o anel do meio fica sem dados ou usa o modelo escolhido no `/admin`.

Não validado: chamadas reais ao Open-Meteo e ao endpoint de uso, Termux:API, interface JavaScript do Fully Kiosk (brilho, apagar, movimento), fator de escala no aparelho. Rode `npm run probe` e abra `/probe` no S20.

## Como trabalhar neste projeto

- O Saulo pediu explicitamente para **não sair codando**. Comece propondo o plano da v1 e espere o ok antes de implementar.
- Respostas diretas e tecnicamente densas. Mudanças pequenas e pontuais, sem reescrever o que já foi aprovado.
- Idioma: português do Brasil.
- Os mocks em `mocks/` são o visual aprovado. Reproduza-os; não redesenhe.

## Objetivo

Reaproveitar um Galaxy S20 parado como monitor de mesa: um painel sempre visível, bonito e gráfico, com informações úteis.

## Requisitos decididos pelo Saulo

- **Tudo roda no celular.** Sem Raspberry Pi, sem nuvem, sem PC ligado. O S20 é servidor e tela ao mesmo tempo.
- **Página de configurações** e **construtor de tela**, acessados pelo navegador do PC apontando para o IP do celular.
- **Conteúdo do painel**: data e hora, previsão do tempo, uso do Claude (assinatura Max) e uso do Fable.
- **Fora do escopo atual**: e-mails, agenda e Bambu A1. Foram desenhados na v1 e removidos a pedido. Se voltarem, as contas de e-mail seriam IMAP, Microsoft 365 e Gmail.
- **Várias telas que se alternam**, por causa do burn-in do AMOLED.

## Arquitetura proposta (ainda não validada na prática)

Proposta feita na conversa; o Saulo não contestou, mas nada foi testado no aparelho.

- **Termux + Node.js** no S20, servidor HTTP na porta 8080. **Termux:Boot** para subir sozinho após reinício.
- **`/`**: o painel, aberto em tela cheia no próprio celular pelo **Fully Kiosk Browser**.
- **`/admin`**: aberto no PC, protegido por senha, com duas áreas:
  - construtor de tela: grade com arrastar e soltar, várias páginas;
  - configurações: chaves, cidade do clima, tema, brilho, horários, intervalos.
- **WebSocket** entre servidor e painel: salvar no `/admin` atualiza a tela do celular na hora.
- **Chaves e tokens só no servidor**, em arquivo local; nunca enviados ao navegador.
- **Widgets como plugins**: cada widget tem um coletor (servidor) e um componente visual (painel). Widget novo = arquivo novo.
- **Histórico local**: o servidor grava as leituras de uso do Claude a cada coleta. Os gráficos de 7 dias e a curva da sessão dependem disso e começam vazios.

Cuidados no Android:
- tirar o Termux da otimização de bateria e usar `termux-wake-lock`;
- reservar IP fixo para o S20 no DHCP do roteador;
- ativar a proteção de bateria (limite de carga em 80–85%), porque o aparelho fica na tomada o tempo todo.

## Tela e resolução

O aparelho é um **Galaxy S20** (o briefing original dizia S22 por engano; os mocks ainda trazem "S22" no título).

- Tela física do S20: 3200×1440, mas o Android renderiza em **2400×1080 (FHD+)** por padrão; proporção 20:9, usada deitada.
- O navegador deve enxergar cerca de **800×360 px CSS** (escala 3x em FHD+, 4x em WQHD+). Não foi medido no aparelho; confira em `/probe`.
- Os mocks foram desenhados em 780×360. O painel mantém esse palco e se ajusta sozinho: em 800×360 sobram ~10 px pretos de cada lado.
- A proteção de bateria do S20 (One UI 4+) limita a carga em 85%, valor fixo.

## As três telas

Arquivos: `mocks/telaN.html` (HTML estático, abre direto no navegador) e `mocks/telaN.png`.

**Tela 1: principal**
- Linha de cima: relógio grande com data (esquerda, com status online e IP do aparelho) e tempo (direita: atual, sensação, chuva, vento, previsão de 5 dias).
- Linha de baixo, card inteiro "Claude · assinatura Max": três anéis na ordem **sessão de 5 h, semana do Fable, semana de todos os modelos**, cada um com percentual no centro e quando renova; à direita, barras dos últimos 7 dias.

**Tela 2: tempo em detalhe**
- Faixa de cima: curva de temperatura das próximas 24 h, com chance de chuva por hora em barras azuis.
- Embaixo: arco do sol (nascer, pôr, quanto falta), Claude em uma linha fina (sessão, Fable, semana) e relógio pequeno no canto inferior direito.

**Tela 3: saúde do sistema**
- Coluna esquerda: bateria e limite de carga, temperatura, tempo do servidor no ar, memória livre, sinal do Wi-Fi, status da VPN no Pi; relógio no canto inferior esquerdo.
- Área direita: curva do uso acumulado na sessão de 5 h com projeção tracejada até a renovação; embaixo, latência da internet na última hora.

Todos os números dos mocks são de exemplo.

## Visual

- Fundo preto puro `#000000`. Card `#0D0E10`, borda `#1C1E22`, raio 14 px (só a tela 1 usa cards; as telas 2 e 3 não têm bordas).
- Texto: `#E8EAED` principal, `#C4C7CC` secundário, `#9AA0A6` rótulos. Relógio em `#C4C7CC`, de propósito menos brilhante.
- Cores de dado: âmbar `#F5A524` (destaque e sessão), lilás `#C58AF9` (Fable), azul `#8AB4F8` (semana, chuva, latência), verde `#4ADE80` (status ok).
- Fontes: Space Grotesk para números, Inter para o resto. Os mocks carregam do Google Fonts; no aparelho, sirva as fontes localmente para funcionar sem internet.
- Margem externa de 12 px na tela 1: é a folga do pixel shift.

## Contadores do Claude

`config.claudeView`: quais dos três contadores (sessão, semana do modelo, semana geral) aparecem e em que ordem, nas telas 1 (anéis) e 2 (linha); `showStats` liga os 7 dias na tela 1; `hideUnlimited` (padrão ligado) tira o contador que o plano não tem (sessão no Ultra). Na tela 1 o card tem 4 espaços: cada anel ocupa 1 e a estatística fica com 0,8 + o espaço dos anéis que saíram; sempre 7 dias, barras mais largas. O card nunca fica vazio.

## Calendário ao lado do relógio (tela 1)

Escolhido em 25/11/2026 para o espaço livre do card do relógio. `widgets/calendar/`: mês com hoje marcado, feriados nacionais em vermelho e pontos facultativos (Carnaval, Corpus Christi) em lilás, e a linha "próximo feriado". Feriados calculados no aparelho (Páscoa por Meeus), sem internet. Com ele o relógio cai de 84 para 64 px. Liga/desliga em `/admin` → Telas (`tela1.clockExtra`). Módulos de widget que o navegador precisa além do `view.js` se chamam `*.shared.js`.

## Cor (opção C, escolhida em 25/11/2026)

Cor com significado, em `panel/mood.js`. Fundo continua preto; tons de fundo sempre muito escuros.
- Relógio: card e dígitos quentes de dia (entre nascer e pôr do sol), frios à noite. Vale para os relógios das três telas.
- Card do tempo (tela 1): tinta conforme a condição (chuva azul, sol âmbar, nublado cinza, noite índigo).
- Uso do Claude: anel, barra e curva ficam laranja `#FB8C3C` se o ritmo linear desde o início da janela estoura o limite antes de renovar (aviso "acaba qui 17h"; só depois de 10% da janela) ou ≥ 75% / severidade "warning"; vermelho `#F87171` com ≥ 90%, severidade "critical" ou limite atingido.
- Tela 3: temperatura da bateria (≥ 40° laranja, ≥ 45° vermelho), memória < 512 MB, Wi-Fi ≤ −75 dBm e latência ≥ 150 ms ficam laranja; internet fora, vermelho.

## Burn-in

Decidido na conversa, em ordem de importância:

1. Tela apagada sem ninguém por perto: detecção de movimento do Fully Kiosk pela câmera frontal, mais horário noturno fixo.
2. Brilho baixo: cerca de 30–40% de dia e 5–10% à noite, por horário.
3. Pixel shift: o painel inteiro se desloca alguns pixels a cada minuto.
4. Rotação entre as três telas a cada 2 a 5 minutos, com transição passando pelo preto. Toque na tela pula para a próxima.
5. As telas são "negativos" umas das outras: divisões em alturas e sentidos diferentes, relógio em três cantos diferentes, telas 2 e 3 sem molduras.
6. Tela ociosa (ainda sem mock): só o relógio em cinza escuro, mudando de posição a cada minuto, antes de a tela apagar.

Configuráveis no `/admin`: horário noturno, brilho dia/noite, tempo até apagar, intervalo do pixel shift e da rotação.

## Fontes de dados

- **Tempo**: Open-Meteo, gratuito e sem chave. Sugerido na conversa; não testado.
- **Uso do Claude (assinatura)**: não há API oficial para os limites do plano. Ferramentas da comunidade usam endpoints não documentados: o que a página de uso do claude.ai consulta (`/api/organizations/{org_id}/usage`) e `https://api.anthropic.com/api/oauth/usage` com o token OAuth do Claude Code. Há relatos de 429 persistente no segundo para assinantes Max. Pode quebrar sem aviso: o widget deve mostrar "sem dados" em vez de travar o painel, e a coleta deve ser espaçada.
- **Sistema do S20**: Termux:API (`termux-battery-status`, `termux-wifi-connectioninfo`) e leituras do próprio processo Node.

## Pendências e incertezas

- **Fable com limite semanal próprio**: o mock mostra um percentual semanal só do Fable. Não foi verificado se a assinatura expõe esse número. Se não expuser, o bloco vira contagem de uso do Fable sem percentual.
- **Viabilidade do endpoint de uso** a partir do celular: onde fica o token e como renová-lo sem o Claude Code instalado no S20.
- **Mock do `/admin`** (construtor e configurações): ainda não foi feito.
- **Mock da tela ociosa**: ainda não foi feito.
- **Fator de escala 3x**: confirmar no aparelho.
- **VPN no Pi** na tela 3: é só um status lido pela rede; o Pi não participa do sistema.

## Próximo passo sugerido

Validar no S20, antes de qualquer interface: Termux + Node servindo uma página, Fully Kiosk em tela cheia, e uma chamada de teste ao endpoint de uso do Claude. Se a coleta de uso não for viável, o desenho das três telas muda, porque o Claude ocupa metade delas.
