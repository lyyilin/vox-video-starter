#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$repo_root/skills/vox-video-studio"
skill_root="$HOME/.agents/skills"
destination="$skill_root/vox-video-studio"

if [[ -e "$destination" ]]; then
  echo "Skill already exists at $destination. Move or remove it explicitly before reinstalling." >&2
  exit 1
fi

mkdir -p "$skill_root"
cp -R "$source_dir" "$destination"
echo "Installed Skill to $destination. Start a new Agent task so it can be discovered."
