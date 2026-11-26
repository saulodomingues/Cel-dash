#!/data/data/com.termux/files/usr/bin/sh
# Instala (ou atualiza) e inicia o painel. Comando para colar no Termux:
#   pkg install -y git && git clone https://github.com/USUARIO/Cel-dash.git && sh Cel-dash/scripts/bootstrap.sh
# Com a pasta já clonada, o script só atualiza (git pull) e reinicia; REPO só é usado se ela não existir.
set -e
REPO="${REPO:-https://github.com/saulodomingues/Cel-dash.git}"
DIR="$HOME/Cel-dash"

# atualiza tudo antes: instalar o Node sobre bibliotecas antigas dá "CANNOT LINK EXECUTABLE"
pkg update -y
yes | pkg upgrade -y -o Dpkg::Options::=--force-confnew
pkg install -y git
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
sh "$DIR/scripts/install-termux.sh"

# reinicia o servidor se já estiver rodando
pkill -f "scripts/run.sh" 2>/dev/null || true
pkill -f "node server/index.js" 2>/dev/null || true
nohup sh "$HOME/.termux/boot/monitor-mesa.sh" >/dev/null 2>&1 &
sleep 3
echo
echo "Painel no ar: abra http://localhost:8080/ no Chrome do celular."
echo "Configurações: http://localhost:8080/admin (ou pelo PC, no IP do celular)."
