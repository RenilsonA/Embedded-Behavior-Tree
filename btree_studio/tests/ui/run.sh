#!/usr/bin/env bash
# Browser tests (real mouse/keyboard in headless Chromium). Needs Node + playwright-core:
#   cd tests/ui && npm i playwright-core
#   CHROME=/path/to/chrome ./run.sh      (CHROME optional if playwright's browser is installed)
# Each script gets a fresh server and an empty workspace.
set -e
cd "$(dirname "$0")"
export PORT=${PORT:-8799}
for t in e2e explore select dynamics passes generate monkey; do
  ws=$(mktemp -d)
  python3 ../../studio.py --port "$PORT" --no-browser --workspace "$ws" >/dev/null 2>&1 &
  pid=$!; sleep 1
  echo "== $t"; node "$t.js" || { kill $pid; exit 1; }
  kill $pid; rm -rf "$ws"
done
