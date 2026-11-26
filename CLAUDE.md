# Monitor de mesa no Galaxy S20

Briefing do projeto. O planejamento foi feito com o Saulo em 24/11/2026; a v1 foi implementada em 25/11/2026 (ver "Estado atual"). Instalação e uso estão no `README.md`.

## Estado atual

**Rodando no S20 desde 25/11/2026**, no Chrome, com Termux e Termux:API do F-Droid. Confirmado no aparelho: tempo (Open-Meteo), uso do Claude (login OAuth da assinatura, conta Ultra), GIFs, brilho e bateria/Wi-Fi pelo Termux:API (depois de dar as permissões), atualização automática pelo GitHub.

- Servidor Node sem dependências (`server/`), SSE em `/events` no lugar do WebSocket proposto.
- Coletores e componentes visuais em `widgets/` (tempo, claude, system; clock só tem visual).
- As três telas reproduzem os mocks; tela ociosa feita sem mock (relógio cinza que muda de lugar).
- `/admin`: senha, ordem e ativação das telas, todas as configurações, credenciais do Claude. O construtor com grade de arrastar e soltar **não** foi feito: a v1 só ordena e liga/desliga as três telas.
- Claude via OAuth da assinatura: botão "Entrar com a conta Claude" no `/admin` (fluxo PKCE do Claude Code, escopo `user:profile`, código colado de volta); renova o token sozinho. Colar credenciais ou ler `~/.claude/.credentials.json` ficaram em "Opções avançadas". O login real não foi testado.
- Atualização automática: `server/updater.js` faz `git pull` a cada 5 min e sai; `scripts/run.sh` sobe de novo; o painel recarrega ao ver a versão mudar. O S20 segue o ramo que clonou.
- O limite semanal por modelo é detectado na resposta (`seven_day_<modelo>`); se não houver o do Fable, o anel do meio fica sem dados ou usa o modelo escolhido no `/admin`.

Navegador do painel (`display.browser`, escolhido em 25/11/2026): **Chrome** por padrão — painel instalável como app (manifest + service worker mínimo, tela cheia, deitado), tela ligada por Wake Lock (só em `http://localhost`), brilho pelo servidor com `termux-brightness` (`server/display.js`, precisa da permissão "Modificar configurações do sistema" no Termux:API), horário de apagar = painel preto. Sem tela ociosa. **Fully** continua disponível como opção (brilho, apagar e movimento pela interface dele).

Ainda não validado no aparelho: cotações (AwesomeAPI e Yahoo), interface JavaScript do Fully Kiosk, fator de escala exato (confira em `/probe`).

Lições da instalação: o Termux:API não existe na Play Store (Termux, Termux:API e Termux:Boot têm de vir todos do F-Droid); `pkg upgrade` antes de instalar o Node, senão "CANNOT LINK EXECUTABLE"; no Samsung, a permissão de brilho fica em Aplicativos → ⋮ → Acesso especial → Alterar configurações do sistema; o Wi-Fi precisa de Localização para o Termux:API; abrir/fechar o Termux não liga o servidor (só o Termux:Boot no reinício ou `sh ~/.termux/boot/monitor-mesa.sh &`).

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
- Espaço entre os cards: 4 px (era 8 px; reduzido a pedido em 25/11/2026).
- Linha de cima: relógio grande com data (esquerda; o status "online · IP", que abre o `/admin` ao toque, foi para a direita do cabeçalho do card do Claude em 25/11/2026) e tempo (direita: atual, sensação, chuva, vento, previsão de 5 dias).
- Linha de baixo, card inteiro "Claude · assinatura Max": três anéis na ordem **sessão de 5 h, semana do Fable, semana de todos os modelos**, cada um com percentual no centro e quando renova; à direita, barras dos últimos 7 dias.

**Tela 2: tempo em detalhe** (layout D, aprovado em 25/11/2026; substitui o mock original)
- Duas linhas alinhadas, sem molduras. Coluna esquerda de 214 px: em cima "Agora" (ícone, temperatura grande, condição e sensação, máx/mín e horário do sol); embaixo, sem título e um embaixo do outro, chuva (pico e mm), umidade, UV (cor de risco) e vento (direção), ocupando a altura dos 7 dias. **Sem relógio** (retirado a pedido em 25/11/2026).
- Coluna direita: em cima a curva das próximas 24 h com a chuva em barras (104 px de altura: a linha das horas fica na mesma altura da linha máx/mín/sol à esquerda; primeira linha da grade com 124 px, 28 px de espaço entre as linhas, barras dos 7 dias com 74 px); embaixo "Próximos 7 dias" em colunas (ícone, máx, barra mín→máx do âmbar ao azul, chance de chuva).

**Tela 3: saúde do sistema**
- Coluna esquerda: bateria e limite de carga, temperatura, tempo do servidor no ar, memória livre, sinal do Wi-Fi, status da VPN no Pi; relógio no canto inferior esquerdo.
- Área direita: curva do uso acumulado na sessão de 5 h com projeção tracejada até a renovação; embaixo, latência da internet na última hora.

**Tela Manchetes** (`news`, aprovada em 25/11/2026, no estilo de canal de notícias; feita para ler sem tocar)
- Topo: "● MANCHETES", quando atualizou e quantas fontes; relógio no canto superior direito.
- Centro: uma manchete grande por vez (fonte, há quanto tempo, n/N, resumo de até 4 linhas), troca sozinha a cada `news.seconds` (12 s) subindo e saindo; "A seguir" e barra vermelha de tempo embaixo.
- Sem letreiro: o "AGORA" foi para o rodapé da tela principal (opcional, `news.ticker`, padrão ligado; `widgets/news/ticker.view.js`): faixa de 22 px com as manchetes passando (sem bloco de cor cheio, por burn-in: só um ponto vermelho `#E5484D` piscando, sem o texto "AGORA"; fundo `#08090A`, borda `#111316`), preservada entre redesenhos por `data-keep` (mas o navegador reinicia a animação ao reinserir o elemento, então `mountTicker` reaplica o atraso depois de todo redesenho) e, ao sair e voltar à tela, retomada de onde parou (`saveTicker` guarda o progresso da animação, `getComputedTiming().progress`, antes de cada troca de conteúdo, e `mountTicker` aplica como atraso negativo; vale mesmo com manchetes novas; guardado também no `localStorage`, porque a página recarrega a cada versão nova do painel); some sem manchetes. Com ele, o card do tempo fica mais compacto.
- `widgets/news/`: parser RSS/Atom próprio (CDATA, entidades; codificação pelo XML, pelo cabeçalho HTTP e, se o texto não for UTF-8 válido, Latin-1 — o UOL manda Latin-1 sem declarar), dedup por título, filtro de horas e palavras, mistura as fontes no começo da fila. Só busca com a tela ligada. A troca e o letreiro rodam em `mountNews`, chamado pelo painel depois que o HTML da tela muda; ao voltar à tela, chegar lista nova ou recarregar a página, segue da manchete seguinte à última mostrada (procura pelo título; se ela saiu, segue pela posição; guardada no `localStorage`).
- Config em `/admin` → Manchetes: fontes do catálogo, outros feeds (URL), tempo por manchete, velocidade do letreiro, intervalo, idade máxima, quantidade, palavras para esconder. Endereços dos feeds do catálogo não testados daqui (rede bloqueada).

Todos os números dos mocks são de exemplo.

## Visual

- Fundo preto puro `#000000`. Card `#0D0E10`, borda `#1C1E22`, raio 14 px (só a tela 1 usa cards; as telas 2 e 3 não têm bordas).
- Texto: `#E8EAED` principal, `#C4C7CC` secundário, `#9AA0A6` rótulos. Relógio em `#C4C7CC`, de propósito menos brilhante.
- Cores de dado: âmbar `#F5A524` (destaque e sessão), lilás `#C58AF9` (Fable), azul `#8AB4F8` (semana, chuva, latência), verde `#4ADE80` (status ok).
- Fontes: Space Grotesk para números, Inter para o resto. Os mocks carregam do Google Fonts; no aparelho, sirva as fontes localmente para funcionar sem internet.
- Margem externa de 12 px na tela 1: é a folga do pixel shift.

## GIFs

Seção própria "GIFs" no `/admin`: envio de vários de uma vez, galeria com prévia animada, 4 por linha (2 no celular), só com o botão "Apagar"; botão direito (ou segurar no celular) abre menu com relógio / Claude / tela cheia / apagar e "Onde mostrar" (relógio, Claude e qual GIF vai na tela cheia, `gif.full`; ligar a tela cheia é em Telas). Salvos em `data/media`. Uso como **widget** ao lado do relógio na tela 1 (`tela1.clockExtra = 'gif'`, `clockGif` = um arquivo ou `'*'` para alternar entre todos a cada passagem pela tela; `widgets/gif/view.js`) à direita do card do Claude na tela 1 (`claudeView.gif`, mesmos valores; coluna fixa de 124 px) e, opcionalmente, como tela cheia. O painel reaproveita o mesmo `<img data-keep>` entre redesenhos, para a animação não reiniciar.

Tela cheia: quinta opção da rotação, desligada por padrão. Quarta tela (`gif`): só uma imagem animada em tela cheia sobre preto. Envio em `/admin` → Telas (GIF, PNG, JPG ou WEBP até 20 MB, conferido pelo conteúdo), guardado em `data/media`, servido em `/media/<hex>.<ext>`. Várias imagens: cada passagem pela tela mostra a próxima. Ajuste caber/preencher. Só entra na rotação se houver imagem. O painel não recria o HTML quando nada mudou, para o GIF não reiniciar a cada dado novo.

## Alerta de chuva e qualidade do ar (25/11/2026)

`widgets/weather/air.shared.js`. Alerta: precipitação de 15 em 15 min do Open-Meteo (`minutely_15`, 3 h); acima de 0,1 mm num intervalo conta como chuva; avisa quando a chuva começa ou para nas próximas 2 h ("chuva começa em ~30 min", "chuva para em ~20 min", "chuva chegando"). Aparece no cabeçalho da curva das 24 h (tela 2) e como etiqueta no card do tempo (tela 1); sem chuva por perto, nada aparece. Ar: `air-quality-api.open-meteo.com` (`us_aqi`, `pm2_5`), faixas do AQI americano com nomes em português; 5º item da coluna da tela 2 e linha "Ar" no card do tempo da tela 1. Se o serviço do ar falhar, o tempo segue sem ele.

## Contadores do Claude

`config.claudeView`: quais itens aparecem e em que ordem, da esquerda para a direita, na tela 1 (a linha do Claude saiu da tela 2): os três contadores (sessão, semana do modelo, semana geral) e, desde 26/11/2026, o gráfico dos 7 dias como quarto item da mesma lista (`id: 'stats'`), que pode ir para qualquer posição; `showStats` só acompanha esse item, por compatibilidade; `hideUnlimited` (padrão ligado) tira o contador que o plano não tem (sessão no Ultra). Na tela 1 os 7 dias são barras deitadas (um dia por linha, hoje primeiro em âmbar e depois os anteriores, valor = % do limite semanal gasto no dia, sem título) numa coluna fixa (170 px; 150 com 3 anéis; 140 com GIF); os anéis dividem o resto. Com 1 ou 2 anéis eles crescem (108 px, 96 com GIF); com 3 ficam em 78 px; coluna abaixo de 170 px vira formato compacto. O card nunca fica vazio.

## Cotações ao lado do relógio (tela 1)

Terceira opção do espaço ao lado do relógio (`tela1.clockExtra = 'quotes'`), conforme o mock de 25/11/2026 feito no Claude Design (três variações: calendário, cotações, GIF). `widgets/quotes/`: até 6 itens escolhidos em `/admin` → Telas (`quotes.items`, catálogo em `catalog.shared.js`): moedas em R$ e cripto em US$ pela AwesomeAPI (sem chave), índices pelo gráfico do Yahoo Finance (não oficial, ~15 min de atraso). Linha = código, valor curto (5,42 · 98,4 mil · 6.012) e seta verde/vermelha; cabeçalho com a hora da cotação mais antiga. Só busca quando o espaço mostra cotações. Fontes não testadas daqui (rede bloqueada).

## Calendário ao lado do relógio (tela 1)

Escolhido em 25/11/2026 para o espaço livre do card do relógio. `widgets/calendar/`: mês com hoje marcado, feriados nacionais em vermelho e pontos facultativos (Carnaval, Corpus Christi) em lilás, e a linha "próximo feriado". Feriados calculados no aparelho (Páscoa por Meeus), sem internet. Com ele o relógio cai de 84 para 64 px. O widget do lado direito ocupa a altura toda do card (calendário em escala 1,2: 134 px de largura). Liga/desliga em `/admin` → Telas (`tela1.clockExtra`). Módulos de widget que o navegador precisa além do `view.js` se chamam `*.shared.js` (servidor e navegador) ou `*.view.js` (só navegador); o servidor só entrega esses.

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

Tempo por tela (25/11/2026): cada item de `screens` tem `seconds` (null = o geral, `rotation.intervalSec`); padrões Principal 180 s, Tempo 60 s, Sistema 45 s, GIF 30 s. Manchetes tem `auto` (padrão): fica o tempo de passar todas as manchetes uma vez (nº de manchetes × `news.seconds`, mínimo 30 s), ou tempo fixo.

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
