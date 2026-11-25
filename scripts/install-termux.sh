#!/data/data/com.termux/files/usr/bin/sh
# Instalação no Termux do S20. Rode de dentro da pasta do projeto:  sh scripts/install-termux.sh
set -e
cd "$(dirname "$0")/.."
DIR="$(pwd)"

# atualiza tudo antes: instalar o Node sobre bibliotecas antigas dá "CANNOT LINK EXECUTABLE"
pkg update -y
yes | pkg upgrade -y -o Dpkg::Options::=--force-confnew
pkg install -y nodejs-lts termux-api git

# sobe sozinho depois de reiniciar o aparelho (precisa do app Termux:Boot aberto uma vez)
mkdir -p "$HOME/.termux/boot"
cat > "$HOME/.termux/boot/monitor-mesa.sh" <<BOOT
#!/data/data/com.termux/files/usr/bin/sh
exec sh "$DIR/scripts/run.sh"
BOOT
chmod +x "$HOME/.termux/boot/monitor-mesa.sh"

echo
echo "Pronto. Para iniciar agora:   sh ~/.termux/boot/monitor-mesa.sh &"
echo "Para validar as fontes:       npm run probe"
