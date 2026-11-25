# Monitor de mesa no Galaxy S20

Painel de mesa que roda inteiro no celular: o S20 coleta os dados, serve as páginas e mostra a tela. Sem PC ligado, sem nuvem, sem Raspberry Pi.

- **`/`** é o painel, aberto em tela cheia no próprio S20 pelo Fully Kiosk Browser.
- **`/admin`** são as configurações e as telas, abertas no próprio celular ou no navegador do PC (`http://IP-DO-S20:8080/admin`).

Sem dependências: só Node 20+ e os arquivos deste repositório.

## Ver no PC antes de instalar

```sh
npm run demo        # dados de exemplo, iguais aos dos mocks
```

Abra `http://localhost:8080/` (painel) e `http://localhost:8080/admin`. Para fixar uma tela: `/?screen=tela2`.

## Instalar no S20

1. Instale pelo **F-Droid** (as versões da Play Store estão abandonadas): **Termux**, **Termux:API** e **Termux:Boot**. Abra o Termux:Boot uma vez.
2. No Termux:
   ```sh
   pkg install -y git
   git clone https://github.com/saulodomingues/Cel-dash.git
   cd Cel-dash
   sh scripts/install-termux.sh
   ```
   O script instala Node e Termux:API e cria `~/.termux/boot/monitor-mesa.sh`, que sobe o servidor sozinho a cada reinício do aparelho.
3. Inicie agora: `sh ~/.termux/boot/monitor-mesa.sh &`
4. Valide as fontes de dados: `npm run probe`. Ele testa Termux:API, rede, Open-Meteo e o uso do Claude, um por um.
5. No Android: tire o Termux da otimização de bateria, ligue a proteção de bateria (limite de carga) e reserve um IP fixo para o S20 no roteador.

### Login do Claude (OAuth)

O painel lê o uso da assinatura com o token OAuth do Claude Code. Dois caminhos, escolhidos no `/admin`:

- **No próprio S20 (recomendado):** instale o Claude Code no Termux (`npm install -g @anthropic-ai/claude-code`), rode `claude` e faça o login. O painel lê `~/.claude/.credentials.json` e renova o token sozinho, regravando o arquivo.
- **Colando credenciais:** no PC, copie o conteúdo de `~/.claude/.credentials.json` (Linux e Windows; no macOS fica no Keychain) e cole em `/admin` → Claude. Como o refresh token é rotativo, o Claude Code do PC pode pedir login de novo depois que o S20 renovar o dele.

O endpoint de uso não é documentado e pode mudar ou responder 429. Nesse caso o painel mostra "sem dados" no bloco do Claude, espaça as tentativas e o resto segue funcionando. O motivo aparece em `/admin` → Estado da coleta.

### Fully Kiosk Browser

- Start URL: `http://localhost:8080/`
- Tela deitada, tela cheia, manter a tela ligada.
- **Advanced Web Settings → Enable JavaScript Interface: ligado.** É por ela que o painel ajusta o brilho por horário, apaga e acende a tela e recebe a detecção de movimento.
- **Motion Detection: ligado**, com "Turn Screen On on Motion". Sem ela a tela ociosa não entra (o painel não tem como saber se há alguém por perto).
- Abra `http://localhost:8080/probe` para conferir a resolução que o navegador enxerga e se a interface JavaScript está ativa.

## Uso

- Toque na tela: próxima tela. Segurar 1,5 s: abre o `/admin` no próprio celular.
- Primeiro acesso ao `/admin`: cria a senha. Faça isso logo depois de instalar; até lá, qualquer aparelho da rede pode criá-la.
- Salvar no `/admin` atualiza o painel na hora (SSE).

## Estrutura

```
server/    HTTP, SSE, configuração, senha, agendador, histórico (NDJSON)
widgets/   um diretório por widget: collector.js (servidor) + view.js (painel)
panel/     painel: telas, burn-in, fontes locais
admin/     /admin
probe/     sonda de validação no aparelho
data/      criado ao rodar: config.json, secrets.json, history/ (fora do git)
```

Widget novo: crie `widgets/<nome>/collector.js` exportando `id`, `intervalMs(config)` e `collect(ctx)` (e `demo(ctx)` se quiser dados de exemplo); o servidor o carrega sozinho. O componente visual vai em `widgets/<nome>/view.js` e é usado pelas telas em `panel/screens/`.

Testes: `npm test`.
