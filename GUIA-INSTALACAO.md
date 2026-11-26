# Monitor de mesa num celular Android: guia de instalação e de alteração

Este guia tem duas partes:
- **Parte A, para você:** instalar no celular, configurar e usar.
- **Parte B, para o seu Claude Code:** como o projeto funciona por dentro e as regras para alterá-lo sem quebrar nada. Antes de pedir a primeira mudança, diga a ele: *"leia o GUIA-INSTALACAO.md (Parte B) e o CLAUDE.md"*.

---

# Parte A: para você

Este projeto transforma um celular Android parado num painel de mesa sempre ligado: relógio e calendário, previsão do tempo com alerta de chuva e qualidade do ar, uso da sua assinatura Claude, manchetes de notícias, cotações e GIFs. O próprio celular é o servidor e a tela. Não precisa de PC ligado, nuvem nem Raspberry Pi.

Foi feito e testado num Galaxy S20, mas deve funcionar em outros Androids. O desenho foi pensado para a tela deitada, em proporção de 20:9 ou parecida, e se ajusta sozinho ao tamanho.

Você configura tudo pelo navegador do PC, abrindo o endereço do celular na rede. Também dá para configurar no próprio celular.

---

## Resumo

1. Faça uma cópia do repositório (fork) no seu GitHub.
2. No celular, instale o F-Droid e, por ele, Termux, Termux:API e Termux:Boot.
3. No Termux, rode um comando que instala e liga tudo.
4. Dê as permissões no Android.
5. Abra o painel no Chrome do celular e instale como app.
6. No PC, abra `/admin`, crie a senha e configure.

Tempo total: uns 30 minutos.

---

## 1. Sua cópia do projeto (fork)

O celular se atualiza sozinho a partir do repositório que ele clonou. Por isso, o ideal é você ter a **sua cópia**: assim você muda o que quiser, inclusive com o Claude Code, e o seu celular recebe as suas mudanças.

1. Peça ao dono do repositório original para te dar acesso, se ele for privado.
2. No GitHub, abra o repositório e clique em **Fork**. Vai ficar `https://github.com/SEU-USUARIO/Cel-dash`.
3. O código está no ramo **`claude/new-session-ml8lxw`**. Se ele não for o ramo padrão do seu fork, vá em Settings → General → Default branch e escolha esse ramo. Ou, se preferir, crie um `main` a partir dele.

**Repositório privado:** se o seu fork for privado, crie um *fine-grained token* em GitHub → Settings → Developer settings → Fine-grained tokens. Restrinja ao repositório `Cel-dash`, com permissão de **leitura em "Contents"**. Você vai usar esse token em dois momentos: ao clonar no celular (o `git clone` pede usuário e senha; a senha é o token) e depois no `/admin` → Atualização.

---

## 2. Apps no celular (todos do F-Droid)

> **Importante:** o Termux da Play Store não serve. O **Termux:API não existe na Play Store**, e os três apps precisam vir da **mesma loja**, senão não conversam entre si.

1. No navegador do celular, abra **f-droid.org** e instale o app **F-Droid**. O Android vai pedir para permitir a instalação de fontes desconhecidas.
2. No F-Droid, instale:
   - **Termux**: o terminal onde o servidor roda.
   - **Termux:API**: dá acesso a brilho, bateria e Wi-Fi.
   - **Termux:Boot**: liga o servidor sozinho quando o celular reinicia.
3. **Abra o Termux:Boot uma vez.** Só abrir e fechar basta; sem isso ele não funciona.
4. Se você já tinha um Termux da Play Store, desinstale-o antes.

---

## 3. Instalar o painel (no Termux)

Abra o Termux e cole o comando abaixo, trocando `SEU-USUARIO` pelo seu usuário do GitHub:

```sh
pkg update && yes | pkg upgrade && pkg install -y git && git clone https://github.com/SEU-USUARIO/Cel-dash.git && sh Cel-dash/scripts/bootstrap.sh
```

Esse comando:
- atualiza os pacotes do Termux. É obrigatório: sem isso, o Node dá o erro "CANNOT LINK EXECUTABLE";
- baixa o projeto em `~/Cel-dash`;
- instala o Node.js e o Termux:API;
- configura o servidor para subir sozinho a cada reinício, pelo Termux:Boot;
- liga o servidor.

Pode demorar alguns minutos. Se aparecer alguma pergunta sobre arquivo de configuração, responda **Y**.

Ao terminar, aparece: `Painel no ar: abra http://localhost:8080/ no Chrome do celular.`

Se o repositório for privado, o `git clone` vai pedir usuário e senha. Use seu usuário do GitHub e, no lugar da senha, o token do passo 1. Se o Termux não te deixar colar na hora da senha, rode antes `git config --global credential.helper store`.

### Comandos úteis no Termux

```sh
# ligar (ou religar) o servidor
pkill -f run.sh; pkill -f "node server/index.js"; nohup sh ~/.termux/boot/monitor-mesa.sh >/dev/null 2>&1 &

# ver se está no ar e os últimos erros
tail -n 20 ~/Cel-dash/data/server.log

# testar as fontes de dados (tempo, Claude, bateria, Wi-Fi), uma por uma
cd ~/Cel-dash && npm run probe
```

> **Abrir ou fechar o Termux não liga o servidor.** Ele sobe sozinho só quando o celular reinicia, pelo Termux:Boot, ou com o primeiro comando acima. E **não feche o Termux arrastando na lista de apps recentes**: isso derruba o servidor.

---

## 4. Permissões no Android

Os caminhos abaixo são do Samsung (One UI). Em outras marcas os nomes mudam um pouco.

| Para quê | Onde |
|---|---|
| **Brilho por horário** | Configurações → Aplicativos → **⋮** (canto superior) → **Acesso especial** → **Alterar configurações do sistema** → Termux:API → ativar |
| **Sinal do Wi-Fi** (tela de sistema) | Configurações → Aplicativos → Termux:API → Permissões → **Local** → permitir (de preferência "o tempo todo"). Deixe a localização do celular ligada |
| **Não matar o servidor** | Configurações → Aplicativos → **Termux** e **Termux:API** → Bateria → **Sem restrições** |
| **Brilho não ser desfeito** | Configurações → Tela → desligar o **brilho adaptável** |

**Recomendado também:**
- **Proteção de bateria:** ligue o limite de carga (no Samsung: Bateria → Proteção da bateria). O celular vai ficar na tomada o tempo todo.
- **IP fixo:** no roteador, reserve um IP para o celular. Assim o endereço do `/admin` não muda.

Sem as permissões, o Android mostra avisos como "Please enable permission for Termux:API". O painel só tenta de novo a cada 30 minutos, mas o certo é dar as permissões.

---

## 5. Abrir o painel no celular (Chrome)

1. No **Chrome do celular**, abra `http://localhost:8080/`. Tem que ser `localhost`, não o IP: só assim o Chrome deixa manter a tela ligada e instalar como app.
2. Menu **⋮** → **Instalar app** (ou "Adicionar à tela inicial").
3. Abra pelo ícone novo, **"Painel"**. Ele abre em tela cheia, deitado, sem barra de endereço.

**No painel:**
- **Tocar na tela:** passa para a próxima tela.
- **Tocar no "online · IP"** (à direita, no card do Claude) **ou segurar 1,5 s em qualquer lugar:** abre as configurações.

Para conferir a tela, abra `http://localhost:8080/probe`. A página mostra o tamanho que o navegador enxerga e se a tela fica ligada.

> **Opcional, Fully Kiosk Browser:** é pago (licença Plus). Ele detecta movimento pela câmera para apagar a tela quando não tem ninguém por perto. Se usar, escolha "Fully Kiosk Browser" em `/admin` → Brilho e descanso da tela. O `README.md` tem a configuração dele.

---

## 6. Configurar pelo PC (`/admin`)

1. Descubra o IP do celular: Configurações → Conexões → Wi-Fi → engrenagem da rede. Ou olhe no próprio painel, no "online · IP".
2. No navegador do PC, abra **`http://IP-DO-CELULAR:8080/admin`**.
   - Digite o `http://` e o `:8080`. Sem a porta, dá "connection refused".
   - Se o navegador trocar sozinho para `https://` e der "ERR_SSL_PROTOCOL_ERROR", abra numa **janela anônima**. Outra saída é apertar `Win + R` e colar o endereço completo.
3. **Crie a senha logo no primeiro acesso.** Até lá, qualquer aparelho da rede pode criá-la.

### O que configurar

- **Telas:** quais entram na rotação (Principal, Tempo, Sistema, Manchetes, GIF), em que ordem e **quanto tempo cada uma fica**. As Manchetes têm a opção "automático", que é o tempo de passar todas as notícias uma vez.
- **Ao lado do relógio:** calendário (com feriados), cotações (até 6, entre moedas, Bitcoin, Ethereum e bolsas) ou GIF.
- **Claude na tela principal:** quais contadores aparecem e em que ordem, e se mostra os últimos 7 dias.
- **GIFs:** envie vários de uma vez e escolha onde cada um aparece: ao lado do relógio, ao lado do Claude ou em tela cheia. O botão direito num GIF abre um atalho para isso.
- **Manchetes:** fontes (g1, Folha, BBC Brasil, Agência Brasil, Tecnoblog…, ou o endereço RSS de qualquer site), tempo de cada manchete, palavras para esconder, e o **letreiro na tela principal**, ligado ou não.
- **Cidade do tempo:** busque a sua cidade. O padrão é São Paulo.
- **Claude:** veja a seção abaixo.
- **Brilho e descanso da tela:** brilho de dia e de noite, horário noturno e horário de apagar. Com o Chrome, "apagar" deixa o painel todo preto; no AMOLED, pixel preto fica desligado.
- **Sistema:** limite de carga exibido e um serviço da sua rede para monitorar. O "VPN no Pi" é só um exemplo; deixe vazio para esconder.
- **Atualização:** veja a seção 8.

Depois de mudar algo, clique em **"Salvar e aplicar"**. O painel do celular atualiza na hora.

---

## 7. Uso da assinatura Claude

O painel mostra o uso da **sua** assinatura Claude (Pro, Max ou Ultra): a sessão de 5 h, a semana de todos os modelos e a semana de um modelo específico (por exemplo, o Fable), com a projeção de quando acaba.

1. No `/admin` → **Claude**, clique em **"Entrar com a conta Claude"**.
2. Abre uma página do claude.com. Entre e autorize.
3. A página mostra um código. Copie, cole no `/admin` e clique em **"Concluir"**.

O acesso fica guardado só no celular, em `data/secrets.json`, e se renova sozinho.

**Detalhes:**
- **Rótulo do plano:** troque em "Rótulo do plano". O padrão é "assinatura Max".
- **Planos sem sessão de 5 h:** o Ultra não tem esse limite. O contador da sessão some sozinho; dá para mudar em "Claude na tela principal".
- **Endpoint não oficial:** a consulta de uso não é documentada pela Anthropic e pode parar de funcionar sem aviso. Nesse caso o card mostra "sem dados" e o resto do painel segue normal.
- **Termos de uso:** o login usa o mesmo fluxo do Claude Code, mas por outro programa, e os termos da Anthropic restringem o uso do login da assinatura fora dos produtos dela. Fica a seu critério.
- **Problemas:** em "Resposta bruta da última leitura", dentro da seção Claude, dá para ver o que veio do servidor.

---

## 8. Atualização automática

O servidor confere o **seu** repositório a cada 5 minutos. Se houver versão nova no ramo clonado, ele baixa, reinicia e a tela recarrega sozinha.

- Configurações, senha, login do Claude, GIFs e histórico ficam em `~/Cel-dash/data/`, fora do git. As atualizações não mexem neles.
- **Repositório privado:** salve o token do passo 1 em `/admin` → Atualização → "Salvar token" e clique em **"Testar acesso"**.
- Para forçar: `/admin` → Atualização → "Buscar atualização agora".
- **Não edite os arquivos do projeto direto no celular.** Isso trava a atualização. Mude no seu fork; veja a seção 9.

---

## 9. Mudando o painel com o Claude Code

O repositório tem um **`CLAUDE.md`** com o contexto do projeto. Ele descreve as decisões de desenho, as telas, as cores, o burn-in e o que cada parte faz. O Claude Code lê esse arquivo sozinho, então é só pedir o que você quer mudar.

No seu PC:

```sh
git clone https://github.com/SEU-USUARIO/Cel-dash.git
cd Cel-dash
npm run demo     # painel com dados de exemplo em http://localhost:8080 (e /admin)
npm test         # testes automáticos
```

Só precisa do **Node 20 ou mais novo**, sem `npm install`: o projeto não tem dependências.

**Fluxo:** peça a mudança ao Claude Code, confira em `npm run demo`, faça commit e push para o ramo que o celular segue. Em até 5 minutos o celular atualiza sozinho.

**Onde fica cada coisa:**

```
server/     servidor HTTP, configuração, senha, agendador, brilho, atualização automática
widgets/    um diretório por widget: collector.js (servidor) + view.js (painel)
panel/      painel: telas (panel/screens/), cores, burn-in, fontes locais
admin/      página /admin
scripts/    instalação no Termux e laço que mantém o servidor no ar
data/       criado no celular: config, segredos, histórico, GIFs (fora do git)
```

**Coisas que você talvez queira trocar:**
- Os textos dizem **"S20"** (por exemplo "Sistema · S20" e o título das páginas). Se o seu celular for outro, peça ao Claude Code para trocar.
- Os mocks em `mocks/` ainda têm "S22" no título, por um engano antigo. Não fazem diferença.

---

## 10. Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `connection refused` ao abrir o painel ou o `/admin` | O servidor não está rodando. Rode o comando de "ligar" da seção 3 e confira o `server.log`. |
| `CANNOT LINK EXECUTABLE node` | Pacotes do Termux desatualizados. Rode `pkg update && yes \| pkg upgrade` e depois `pkg install -y nodejs-lts`. |
| `ERR_SSL_PROTOCOL_ERROR` no PC | O navegador trocou para `https`. Use `http://IP:8080/admin` numa janela anônima. |
| "Please enable permission for Termux:API" ou "Error in ResultReturner" | Falta permissão. Veja a seção 4 (brilho, localização e bateria). |
| O brilho não muda | Permissão de "Alterar configurações do sistema", ou brilho adaptável ligado. Teste com o botão **"Testar brilho"** no `/admin`. |
| Bateria ou Wi-Fi aparecem "—" | Termux:API não instalado pelo F-Droid, ou sem permissão de Localização (Wi-Fi). |
| Tempo, Claude ou Manchetes com "sem dados" | Veja `/admin` → **Estado da coleta**. Cada fonte mostra o erro e tem o botão "Coletar agora". |
| Alguma fonte de manchete com erro | Desmarque a fonte, ou cole o endereço RSS certo em "Outros feeds". |
| Envio de GIF parado em 0% | Feche outras abas abertas com o painel no PC e tente de novo. |
| O painel não sobe depois de reiniciar o celular | Abra o app Termux:Boot uma vez e confira se o Termux está "Sem restrições" de bateria. |

---

## 11. Cópia de segurança

Tudo o que é seu fica em `~/Cel-dash/data/`. Para guardar uma cópia na pasta Downloads do celular:

```sh
termux-setup-storage   # pede permissão de arquivos; aceite
cp -r ~/Cel-dash/data ~/storage/downloads/painel-data
```

Para restaurar depois de reinstalar:

```sh
cp -r ~/storage/downloads/painel-data/. ~/Cel-dash/data/
```

Depois, religue o servidor com o comando da seção 3.

**Nunca envie a pasta `data/` para o GitHub:** ela tem a sua senha e o seu login do Claude. O `.gitignore` já a deixa de fora.

---

# Parte B: para o Claude Code

> Este trecho é para o assistente que vai alterar o projeto. Leia também o `CLAUDE.md`: ele é o histórico de decisões. Foi escrito para o dono original, e as preferências pessoais de lá (idioma, "não sair codando" etc.) são dele. O dono atual pode trocar à vontade.

## B1. Visão geral

- **Onde roda:** num celular Android, dentro do Termux. O servidor é **Node.js puro, sem dependências** (nada de `npm install`); mantenha assim. Pacote novo complica a instalação no Termux, e módulos nativos quase sempre falham lá.
- **Servidor (`server/index.js`):** HTTP na porta 8080. Entrega o painel (`/`), o `/admin`, a API `/api/...` e o SSE em `/events`, que empurra dados e configuração para o painel na hora.
- **Painel (`panel/`):** HTML e JS de módulos ES, sem build. É desenhado num **palco fixo de 780×360 px** e escalado para caber na tela, que é de uns 800×360 px CSS num celular 20:9 deitado.
- **Widgets como plugins (`widgets/<nome>/`):**
  - `collector.js`: roda no servidor. Exporta `id`, `intervalMs(config)`, `collect(ctx)` e, opcionalmente, `demo(ctx)`, `minRetryMs` e `maxRetryMs`. O `server/scheduler.js` carrega todos sozinho.
  - `view.js`: roda no navegador. Funções que devolvem HTML (string).
  - `*.shared.js` roda nos dois lados; `*.view.js` é extra só do navegador. **O servidor só entrega `view.js`, `*.view.js` e `*.shared.js`.** Coletores e segredos nunca vão para o navegador; não crie nomes fora desse padrão para arquivos que o navegador precisa.
- **Telas (`panel/screens/*.js`):** funções `({ data, config, now, visit }) => html`. Opcionalmente exportam `mount(stage)` (roda depois que o HTML muda) e `beforeLeave(stage)` (roda antes de trocar o conteúdo). Para registrar uma tela nova:
  1. `SCREENS` em `panel/main.js`;
  2. `DEFAULTS.screens` em `server/config.js`;
  3. `SCREEN_NAMES` em `admin/admin.js`.
- **Configuração:** `server/config.js` tem `DEFAULTS` e `sanitize()`, que valida, limita e preenche faltas. **Todo campo novo precisa de padrão e de validação ali.** O que o painel vê sai de `publicConfig()`; segredos ficam em `data/secrets.json` (permissão 600) e **nunca** vão para o navegador.
- **Dados locais (`data/`, fora do git):** `config.json`, `secrets.json`, `cache.json` (último dado bom de cada widget, recuperado ao reiniciar), `history/` (NDJSON por dia) e `media/` (GIFs).

## B2. Como o painel redesenha (importante)

- `render()` em `panel/main.js` gera o HTML da tela atual e **só troca o `innerHTML` se o HTML mudou**. A tela principal muda a cada minuto, por causa de textos como "atualizado há X min".
- Para o relógio, use `data-clock="hm" | "s" | "long" | "short"`: esses elementos são atualizados a cada segundo **sem redesenhar**. Não coloque segundos ou hora atual no HTML de outro jeito, senão a tela redesenha toda hora.
- **Animações não podem reiniciar:**
  - Elementos com `data-keep` são reaproveitados entre redesenhos: `<img>` pela `src`, os demais pelo valor do atributo.
  - Mas o navegador **reinicia animações CSS** quando o elemento sai e volta para a página. Por isso o letreiro (`widgets/news/ticker.view.js`) guarda o progresso em `beforeLeave` e o reaplica em `mount`, com `animation-delay` negativo.
  - Siga esse padrão para qualquer animação contínua.
- **A página recarrega sozinha quando a versão muda** (atualização automática). Estado que precisa sobreviver, como a posição do letreiro ou da fila de manchetes, vai para o `localStorage`, sempre dentro de `try/catch`.
- **Miniaturas do `/admin`:** abrem o painel com `?preview` e **não** usam SSE, só consultam `/api/state`. Isso é de propósito: o navegador só permite 6 conexões por endereço, e SSE nas miniaturas travava o envio de arquivos.

## B3. Regras visuais e de burn-in (tela AMOLED)

- **Fundo:** preto puro `#000000`. Pixel preto fica desligado no AMOLED.
- **Áreas paradas:** sem áreas grandes claras ou de cor cheia paradas no mesmo lugar. Cores de fundo sempre muito escuras; cor forte só em detalhe, alerta ou coisa que se mexe.
- **Já existem:** pixel shift (o palco inteiro se desloca alguns pixels por minuto), rotação de telas com passagem pelo preto, brilho por horário e horário de apagar. Não quebre nada disso.
- **Margem:** a tela principal tem 12 px de margem externa, que é a folga do pixel shift.
- **Paleta e cores com significado:** ficam no `CLAUDE.md` (seções "Visual" e "Cor") e em `panel/mood.js`. Laranja e vermelho são reservados para alertas.
- **Fontes:** Inter e Space Grotesk, servidas localmente de `panel/fonts/`, porque o painel precisa funcionar sem internet.
- **Textos:** em português do Brasil.

## B4. Fontes de dados externas

- **Tempo, chuva de 15 em 15 min e qualidade do ar:** Open-Meteo, sem chave.
- **Cotações:** AwesomeAPI (câmbio e cripto) e o gráfico do Yahoo Finance (índices; não oficial).
- **Manchetes:** feeds RSS/Atom, com parser próprio. A codificação vem do XML, do cabeçalho HTTP e, se não for UTF-8 válido, é lida como Latin-1.
- **Uso do Claude:** endpoint OAuth não documentado (`api.anthropic.com/api/oauth/usage`). A resposta atual traz uma lista `limits` com `kind` (`session`, `weekly_all`, `weekly_scoped`) e `scope.model.display_name`. Pode mudar sem aviso; o coletor espaça bastante as tentativas por causa de 429.
- **Celular:** Termux:API (`termux-battery-status`, `termux-wifi-connectioninfo`, `termux-brightness`). Cada falha de permissão gera um aviso do Android por cima da tela, por isso há recuo de 30 min.
- **Regra geral:** uma fonte que falha **nunca** pode derrubar ou esvaziar o painel. Mantenha o último dado bom, mostre "sem dados" ou "carregando…" e registre o motivo no `/admin` → Estado da coleta.

## B5. Como testar antes de enviar

```sh
npm test                 # testes de unidade (node --test), sem dependências
npm run demo             # servidor com dados de exemplo (DEMO=1): http://localhost:8080 e /admin
DATA_DIR=/tmp/x npm run demo   # usa uma pasta de dados descartável
```

- **Pré-visualizar telas:** `/?preview&screen=tela1` (ou `tela2`, `tela3`, `news`, `gif`) fixa uma tela, sem burn-in e sem toque.
- **Conferir visualmente:** se tiver Playwright disponível, tire um print do painel em **780×360** e confira com os próprios olhos. Garanta que nada transborda: `scrollHeight` igual a `clientHeight` em cada `section`.
- **Testes:** acrescente testes em `test/unit.test.js` para a lógica nova, principalmente para leitura de respostas externas (use um exemplo real da resposta).

## B6. Cuidados com a publicação

- **Cada push no ramo que o celular segue vira atualização no aparelho em até 5 minutos**, com reinício do servidor e recarga da tela. Agrupe mudanças; não faça dezenas de pushes pequenos seguidos.
- **Nunca** envie para o git a pasta `data/`, tokens, senhas ou o login do Claude.
- **Mudança que exige ação no celular** (pacote novo no Termux, permissão nova): não chega pela atualização automática. Avise o dono e atualize a Parte A deste guia e o `README.md`.
- **Documentação:** registre decisões novas no `CLAUDE.md`, para a próxima sessão saber o porquê.
