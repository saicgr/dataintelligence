#!/usr/bin/env bash
# Start the full local stack: Supabase (backend) if available, then Next.js.
# Falls back to keyless seed mode if the Supabase CLI / config isn't present.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
SPARK_PORT="${SPARK_PORT:-4000}"
SUPABASE_STARTED=0
SPARK_PID=""

# Free the dev port so Next binds to it instead of silently bumping to 3001
# (a stray server left on 3000 is what causes the "reading 'call'" webpack error
# when the browser hits a zombie process serving a stale build).
free_port() {
  local pids
  pids="$(lsof -ti ":$1" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "▸ Port $1 is in use (PID(s): $pids) — stopping it..."
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup() {
  if [ -n "$SPARK_PID" ]; then
    echo "▸ Stopping Spark runner..."
    kill "$SPARK_PID" 2>/dev/null || true
  fi
  if [ "$SUPABASE_STARTED" = "1" ]; then
    echo "▸ Stopping local Supabase..."
    supabase stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

# Start the PySpark runner (server-side local mode) if Java + pyspark are present.
# Without it, the app falls back to AI-eval for PySpark — keyless dev still works.
start_spark_runner() {
  local py
  py="$(command -v python3 || command -v python || true)"
  if [ -z "$py" ]; then return; fi
  # `command -v java` passes on the macOS /usr/bin/java STUB even with no JDK,
  # so actually run java -version to confirm a WORKING runtime exists.
  if ! java -version >/dev/null 2>&1; then
    echo "▸ Spark runner: no working Java runtime (the macOS /usr/bin/java stub doesn't count)."
    echo "  Install a JDK 17, e.g.  brew install --cask temurin@17   — then re-run. PySpark uses AI-eval until then."
    return
  fi
  if ! "$py" -c "import pyspark" >/dev/null 2>&1; then
    echo "▸ Spark runner: pyspark not installed (pip install -r spark-runner/requirements.txt) — PySpark will use AI-eval."
    return
  fi
  free_port "$SPARK_PORT"
  echo "▸ Starting Spark runner on http://localhost:$SPARK_PORT ..."
  PORT="$SPARK_PORT" "$py" spark-runner/server.py &
  SPARK_PID=$!
}

if command -v supabase >/dev/null 2>&1 && [ -d "supabase" ]; then
  echo "▸ Starting local Supabase (Postgres + Auth)..."
  if supabase start; then
    SUPABASE_STARTED=1
    echo "▸ Applying schema + seed..."
    supabase db reset --no-confirm >/dev/null 2>&1 || \
      echo "  (skipping db reset — run 'supabase db reset' manually if needed)"
  else
    echo "  Supabase failed to start — continuing in keyless seed mode."
  fi
else
  echo "▸ Supabase CLI not found (or no supabase/ dir) — running in keyless SEED mode."
  echo "  The app is fully functional on bundled seed data. Add .env.local to go live."
fi

start_spark_runner

# Clear a stale PRODUCTION build before starting dev. `next build` writes
# .next/BUILD_ID (dev never does); reusing those prod chunks under `next dev`
# causes "Cannot find module './XXXX.js'" webpack errors. Wipe .next so dev
# rebuilds cleanly.
if [ -f ".next/BUILD_ID" ]; then
  echo "▸ Detected a production .next build — clearing it for a clean dev start..."
  rm -rf .next
fi

free_port "$PORT"

echo "▸ Starting Next.js dev server on http://localhost:$PORT ..."
# Call the Next binary directly (NOT `npm run dev`, which now points back here).
exec node_modules/.bin/next dev -p "$PORT"
