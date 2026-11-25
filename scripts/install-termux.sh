#!/data/data/com.termux/files/usr/bin/sh
# Instalação no Termux do S22. Rode de dentro da pasta do projeto:  sh scripts/install-termux.sh
set -e
cd "$(dirname "$0")/.."
DIR="$(pwd)"

pkg update -y
pkg install -y nodejs-lts termux-api

# sobe sozinho depois de reiniciar o aparelho (precisa do app Termux:Boot aberto uma vez)
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/monitor-mesa.sh" <<BOOT
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd "$DIR"
mkdir -p data
[ -f data/server.log ] && tail -n 2000 data/server.log > data/server.log.old
exec node server/index.js > data/server.log 2>&1
BOOT
chmod +x "$HOME/.termux/boot/monitor-mesa.sh"

echo
echo "Pronto. Para iniciar agora:   sh ~/.termux/boot/monitor-mesa.sh &"
echo "Para validar as fontes:       npm run probe"
