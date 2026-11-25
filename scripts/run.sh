#!/data/data/com.termux/files/usr/bin/sh
# Mantém o servidor no ar: sobe de novo se ele cair ou se sair para aplicar uma atualização.
cd "$(dirname "$0")/.."
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
mkdir -p data
[ -f data/server.log ] && tail -n 2000 data/server.log > data/server.log.old
: > data/server.log
export SUPERVISED=1
while true; do
  node server/index.js >> data/server.log 2>&1
  sleep 3
done
