#!/usr/bin/env bash
# Остановка локального бэкенда VP Forum
cd "$(dirname "$0")"

PORT=3001

if [ -f server.pid ]; then
  PID=$(cat server.pid)
  if kill "$PID" 2>/dev/null; then
    echo "Остановлен процесс $PID"
  fi
  rm -f server.pid
fi

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
fi

echo "Бэкенд остановлен."
