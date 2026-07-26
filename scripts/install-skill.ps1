[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "skills\vox-video-studio"
$skillRoot = Join-Path $env:USERPROFILE ".agents\skills"
$destination = Join-Path $skillRoot "vox-video-studio"

if (Test-Path -LiteralPath $destination) {
  throw "Skill already exists at $destination. Move or remove that folder explicitly before reinstalling."
}

New-Item -ItemType Directory -Force -Path $skillRoot | Out-Null
Copy-Item -LiteralPath $source -Destination $destination -Recurse
Write-Host "Installed Skill to $destination. Start a new Agent task so it can be discovered."
