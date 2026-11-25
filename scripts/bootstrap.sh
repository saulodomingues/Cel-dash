#!/data/data/com.termux/files/usr/bin/sh
# Instala (ou atualiza) e inicia o painel. Comando para colar no Termux (repositório privado):
#   pkg install -y git && git config --global credential.helper store && git clone https://github.com/saulodomingues/Cel-dash.git && sh Cel-dash/scripts/bootstrap.sh
# O git pede usuário e token uma vez e guarda em ~/.git-credentials para as atualizações automáticas.
set -e
REPO=https://github.com/saulodomingues/Cel-dash.git
DIR="$HOME/Cel-dash"

pkg update -y
pkg install -y git
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
sh "$DIR/scripts/install-termux.sh"

# reinicia o servidor se já estiver rodando
pkill -f "scripts/run.sh" 2>/dev/null || true
pkill -f "node server/index.js" 2>/dev/null || true
nohup sh "$HOME/.termux/boot/monitor-mesa.sh" >/dev/null 2>&1 &
sleep 3
echo
echo "Painel no ar: abra http://localhost:8080/ no Fully Kiosk."
echo "Configurações: http://localhost:8080/admin (ou pelo PC, no IP do celular)."
