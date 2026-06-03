#!/usr/bin/env bash
set -euo pipefail

# Update this checkout to origin/main by default, then reload/restart the
# systemd service. Set REF=<branch-or-tag> to override.
#
# Usage:
#   ./scripts/update-vm.sh
#   SERVICE=baduk-live-analysis.service ./scripts/update-vm.sh
#   REF=main ./scripts/update-vm.sh

SERVICE="${SERVICE:-baduk-live-analysis.service}"
REF="${REF:-}"
# Keep VM-facing app ports private behind nginx by default.
# Set BIND_LOCALHOST=0 only if you intentionally expose 8080/8081 directly.
BIND_LOCALHOST="${BIND_LOCALHOST:-1}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_BACKUP=""

cd "$REPO_DIR"

echo "[update] repo: $REPO_DIR"
echo "[update] service: $SERVICE"

if [[ ! -d .git ]]; then
  echo "[update] ERROR: $REPO_DIR is not a git checkout" >&2
  exit 1
fi

if [[ -f config.json ]]; then
  CONFIG_BACKUP="$(mktemp)"
  cp config.json "$CONFIG_BACKUP"
  echo "[update] saved local config.json"
fi

echo "[update] fetching git refs/tags"
git fetch --all --tags --prune

if [[ -z "$REF" ]]; then
  REF="origin/main"
fi

echo "[update] target ref: $REF"

# Avoid local VM config/log files blocking checkout.
git reset --hard HEAD

git checkout "$REF"

# If REF is a branch name, fast-forward it. Tags are detached by design.
if git show-ref --verify --quiet "refs/heads/$REF"; then
  git pull --ff-only origin "$REF"
elif [[ "$REF" == "main" || "$REF" == "master" ]]; then
  git checkout "$REF"
  git pull --ff-only origin "$REF"
fi

if [[ -n "$CONFIG_BACKUP" ]]; then
  cp "$CONFIG_BACKUP" config.json
  rm -f "$CONFIG_BACKUP"
  echo "[update] restored local config.json"
fi

if [[ "$BIND_LOCALHOST" == "1" ]]; then
  echo "[update] enforcing localhost bind for VM nginx proxy"
  if [[ -f config.json ]]; then
    python3 - <<'PY'
import json
from pathlib import Path
p = Path("config.json")
data = json.loads(p.read_text())
data["host"] = "127.0.0.1"
p.write_text(json.dumps(data, indent=2) + "\n")
PY
  fi
fi

echo "[update] current version: $(git log --oneline -1)"

echo "[update] reloading systemd"
sudo systemctl daemon-reload

echo "[update] restarting $SERVICE"
sudo systemctl restart "$SERVICE"

echo "[update] status"
sudo systemctl --no-pager --lines=20 status "$SERVICE"

echo "[update] done"
