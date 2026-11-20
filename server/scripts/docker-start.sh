#!/usr/bin/env bash
set -uo pipefail

# Use the venv baked into the image (Linux). Ignore invalid host paths e.g. Windows Scripts\python.exe.
DOCKER_PYTHON="/app/.venv-markitdown/bin/python"
if [[ ! -x "${DOC_PARSER_PYTHON_PATH:-}" ]]; then
	if [[ -n "${DOC_PARSER_PYTHON_PATH:-}" ]]; then
		echo "DOC_PARSER_PYTHON_PATH is not executable (${DOC_PARSER_PYTHON_PATH}); using ${DOCKER_PYTHON}"
	fi
	export DOC_PARSER_PYTHON_PATH="${DOCKER_PYTHON}"
fi
export DOC_PARSER_SCRIPT_PATH="${DOC_PARSER_SCRIPT_PATH:-/app/src/services/python/parse_document.py}"

api_pid=""
worker_pid=""

cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi

  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Start the API first so the platform's port scan sees an open port right
# away. Running migrations before this delays port binding, and hosts such as
# Render cancel the deploy with "no open ports detected".
echo "Starting API server"
bun --smol src/index.ts &
api_pid=$!

# Fail early with the API's actual startup error instead of allowing the
# migration command below to hide it until Render's port scan times out.
api_url="http://127.0.0.1:${PORT:-8000}/"
api_ready=false
for attempt in $(seq 1 60); do
	if ! kill -0 "$api_pid" 2>/dev/null; then
		echo "ERROR: API process exited before binding to ${api_url}"
		wait "$api_pid"
		exit 1
	fi

	if curl --silent --show-error --fail --max-time 1 "$api_url" >/dev/null 2>&1; then
		api_ready=true
		echo "API is listening on ${api_url}"
		break
	fi

	sleep 1
done

if [[ "$api_ready" != true ]]; then
	echo "ERROR: API did not respond on ${api_url} within 60 seconds"
	if kill -0 "$api_pid" 2>/dev/null; then
		kill "$api_pid" 2>/dev/null || true
	fi
	wait "$api_pid" || true
	exit 1
fi

echo "Running database migrations"
if bunx prisma migrate deploy; then
	echo "Database migrations applied"
else
	echo "WARNING: prisma migrate deploy failed; the API is still serving but the schema may be out of date"
fi

echo "Starting background workers"
bun --smol src/worker.ts &
worker_pid=$!

wait -n "$api_pid" "$worker_pid"
