#!/data/data/com.termux/files/usr/bin/sh
# Instala (ou atualiza) e inicia o painel com um comando só, colado no Termux:
#   curl -L https://raw.githubusercontent.com/saulodomingues/Cel-dash/HEAD/scripts/bootstrap.sh | sh
set -e
REPO=https://github.com/saulodomingues/Cel-dash.git
DIR="$HOME/Cel-dash"

pkg update -y
pkg install -y git
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
sh "$DIR/scripts/install-termux.sh"

# reinicia o servidor se já estiver rodando
pkill -f "node server/index.js" 2>/dev/null || true
nohup sh "$HOME/.termux/boot/monitor-mesa.sh" >/dev/null 2>&1 &
sleep 3
echo
echo "Painel no ar: abra http://localhost:8080/ no Fully Kiosk."
echo "Configurações: http://localhost:8080/admin (ou pelo PC, no IP do celular)."
