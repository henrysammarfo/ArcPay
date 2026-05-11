#!/usr/bin/env bash
set -euo pipefail

if grep -qiE "microsoft|wsl" /proc/version 2>/dev/null; then
  cat >&2 <<'EOF'
QVAC live proof must run on native Linux x64, not WSL.

QVAC team confirmed linux-x64 binaries are tested and used in production, but
WSL is currently untested. Run this script on a native Linux x64 host or VM.
EOF
  exit 1
fi

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  printf 'QVAC live proof requires native linux-x64. Found %s-%s.\n' "$(uname -s)" "$(uname -m)" >&2
  exit 1
fi

RUNTIME_DIR="${QVAC_RUNTIME_DIR:-$HOME/arcpay-qvac-runtime}"
ARCPAY_DIR="${ARCPAY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

log() {
  printf '\n==> %s\n' "$1"
}

dump_latest_npm_log() {
  local latest_log
  latest_log="$(ls -t "$HOME"/.npm/_logs/*debug-0.log 2>/dev/null | head -1 || true)"

  if [[ -n "$latest_log" ]]; then
    printf '\nLatest npm log: %s\n' "$latest_log"
    grep -iE "npm err| error |error:|err!|eio|enoent|eacces|etimedout|killed|fatal|exit|code|signal|stack|rollback|reify failed" "$latest_log" | tail -220 || true
    tail -120 "$latest_log" || true
  fi
}

log "Preparing clean QVAC runtime at $RUNTIME_DIR"
if [[ -d "$RUNTIME_DIR" ]]; then
  mv "$RUNTIME_DIR" "${RUNTIME_DIR}.broken.$(date +%s)"
fi

mkdir -p "$RUNTIME_DIR"
cd "$RUNTIME_DIR"
npm init -y >/dev/null

log "Writing explicit QVAC runtime dependencies"
npm pkg set dependencies.@qvac/sdk=0.10.2

log "Installing QVAC runtime dependencies with canonical npm install"
if ! npm install \
  --registry=https://registry.npmjs.org/ \
  --include=optional \
  --no-audit \
  --no-fund \
  --fetch-timeout=1800000 \
  --fetch-retries=10 \
  --fetch-retry-maxtimeout=120000; then
  dump_latest_npm_log
  exit 1
fi

log "Verifying QVAC package imports"
npm list @qvac/sdk --depth=0 || true

test -f node_modules/@qvac/sdk/package.json

node -e 'import("./node_modules/@qvac/sdk/dist/index.js").then(m => console.log("qvac sdk ok", typeof m.loadModel, typeof m.completion)).catch(e => { console.error(e); process.exit(1) })'

log "Running ArcPay QVAC proof"
cd "$ARCPAY_DIR"
ARCPAY_REQUIRE_LIVE_QVAC=true \
QVAC_SDK_PATH="$RUNTIME_DIR/node_modules/@qvac/sdk" \
QVAC_LINUX_HOST_CONFIRMED=true \
QVAC_MODEL_CONFIG_JSON='{"ctx_size":"2048","device":"cpu"}' \
QVAC_PROOF_TIMEOUT_MS=180000 \
npm run proof:qvac -w @arcpay/agent
