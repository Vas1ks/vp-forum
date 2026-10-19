#!/usr/bin/env bash
# Запуск локального бэкенда VP Forum на http://localhost:3001
set -e
cd "$(dirname "$0")"

PORT=3001

if command -v lsof >/dev/null 2>&1 && lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Бэкенд уже запущен на порту $PORT"
  exit 0
fi

mkdir -p node_modules
if [ ! -d node_modules/express ]; then
  echo "Устанавливаю зависимости..."
  npm install
fi

setsid node server.js > server.log 2>&1 < /dev/null &
echo $! > server.pid

for i in $(seq 1 20); do
  if curl -s -o /dev/null -m 2 "http://localhost:$PORT/users"; then
    echo "✅ Бэкенд запущен: http://localhost:$PORT (PID $(cat server.pid))"
    exit 0
  fi
  sleep 0.5
done

echo "⚠️  Не удалось проверить бэкенд. Смотри server.log"
exit 1
