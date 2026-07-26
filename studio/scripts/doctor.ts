import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type Check = { name: string; ok: boolean; detail: string; required: boolean };

const commandVersion = (command: string, args: string[]): string | null => {
  const executable = process.platform === "win32" ? "cmd.exe" : command;
  const executableArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/u)[0] ?? "ok";
};

const checks: Check[] = [];
const addCommand = (name: string, command: string, args: string[], required = true) => {
  const detail = commandVersion(command, args);
  checks.push({ name, ok: detail !== null, detail: detail ?? "not found", required });
};

addCommand("Node.js", "node", ["--version"]);
addCommand("pnpm", process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"]);
addCommand("FFmpeg", "ffmpeg", ["-version"]);
addCommand("FFprobe", "ffprobe", ["-version"]);
addCommand("Git", "git", ["--version"], false);

const pythonPath = process.platform === "win32"
  ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
  : path.join(process.cwd(), ".venv", "bin", "python");
checks.push({
  name: "Python virtual environment",
  ok: fs.existsSync(pythonPath),
  detail: fs.existsSync(pythonPath) ? pythonPath : "studio/.venv is missing",
  required: true,
});

const envFile = path.join(process.cwd(), ".env");
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
const hasSeedKey = /^VOLCENGINE_SPEECH_API_KEY=\S+/mu.test(envText);
checks.push({
  name: "Seed-TTS 2 API key",
  ok: hasSeedKey,
  detail: hasSeedKey ? "configured (value hidden)" : "optional until audio:build; see docs/CONFIGURATION.md",
  required: false,
});

for (const check of checks) {
  const icon = check.ok ? "PASS" : check.required ? "FAIL" : "WARN";
  console.log(`${icon.padEnd(4)} ${check.name}: ${check.detail}`);
}

if (checks.some((check) => check.required && !check.ok)) {
  process.exitCode = 1;
} else {
  console.log("Environment is ready for the local VOX pipeline.");
}
