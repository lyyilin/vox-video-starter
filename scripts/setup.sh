#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
studio_root="$repo_root/studio"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing $1. $2" >&2
    exit 1
  fi
}

require_command node "Install Node.js 20+ from https://nodejs.org/."
require_command ffmpeg "Install FFmpeg and add it to PATH."
require_command ffprobe "FFprobe is included with FFmpeg."

if ! command -v pnpm >/dev/null 2>&1; then
  require_command corepack "Install pnpm 9+ from https://pnpm.io/installation."
  corepack enable
  corepack prepare pnpm@10.15.0 --activate
fi

require_command python3.10 "Install Python 3.10 for the pinned rembg environment."

cd "$studio_root"
pnpm install --frozen-lockfile

if [[ ! -x .venv/bin/python ]]; then
  python3.10 -m venv .venv
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-matte.txt -r requirements-volc-tts.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created studio/.env. Add your own API key locally; do not commit it."
fi

pnpm run doctor
echo "Setup complete. Return to the copy-and-paste Agent prompt in README.md."
