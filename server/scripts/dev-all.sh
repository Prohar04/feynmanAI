#!/usr/bin/env bash
set -euo pipefail

api_pid=""
worker_pid=""
tts_pid=""

cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi

  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
  fi

  if [[ -n "$tts_pid" ]]; then
    kill "$tts_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting Kokoro TTS server (npm run tts:start)"
npm run tts:start &
tts_pid=$!

# Do not let the first API request race model initialization. The API also
# retries Kokoro readiness, but this makes normal local startup deterministic.
for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${TTS_PORT:-8125}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "Starting API server (npm run dev)"
npm run dev &
api_pid=$!

echo "Starting product worker (npm run worker:dev)"
npm run worker:dev &
worker_pid=$!

wait -n "$api_pid" "$worker_pid" "$tts_pid"
