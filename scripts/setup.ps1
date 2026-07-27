[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$studioRoot = Join-Path $repoRoot "studio"

function Require-Command {
  param([string]$Name, [string]$Help)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing $Name. $Help"
  }
}

Require-Command "node" "Install Node.js 20+ from https://nodejs.org/."
Require-Command "ffmpeg" "Install FFmpeg and add it to PATH."
Require-Command "ffprobe" "FFprobe is included with FFmpeg; add its bin directory to PATH."

if (-not (Get-Command "pnpm" -ErrorAction SilentlyContinue)) {
  Require-Command "corepack" "Install pnpm 9+ from https://pnpm.io/installation."
  corepack enable
  corepack prepare pnpm@10.15.0 --activate
}

$pythonCommand = $null
if (Get-Command "py" -ErrorAction SilentlyContinue) {
  $probe = & py -3.10 --version 2>&1
  if ($LASTEXITCODE -eq 0) {
    $pythonCommand = @("py", "-3.10")
  }
}
if (-not $pythonCommand -and (Get-Command "python" -ErrorAction SilentlyContinue)) {
  $probe = & python --version 2>&1
  if ($probe -match "Python 3\.10\.") {
    $pythonCommand = @("python")
  }
}
if (-not $pythonCommand) {
  throw "Python 3.10 is required for the pinned rembg environment. Install it and rerun this script."
}

Push-Location $studioRoot
try {
  pnpm install --frozen-lockfile

  $venvPython = Join-Path $studioRoot ".venv\Scripts\python.exe"
  if (-not (Test-Path -LiteralPath $venvPython)) {
    if ($pythonCommand.Count -eq 2) {
      & $pythonCommand[0] $pythonCommand[1] -m venv .venv
    } else {
      & $pythonCommand[0] -m venv .venv
    }
  }

  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r requirements-matte.txt -r requirements-volc-tts.txt

  if (-not (Test-Path -LiteralPath ".env")) {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host "Created studio/.env. Add your own API key locally; do not commit it."
  }

  pnpm run doctor
} finally {
  Pop-Location
}

Write-Host "Setup complete. Return to the copy-and-paste Agent prompt in README.md."
