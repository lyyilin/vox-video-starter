import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = process.argv[2];
if (!script) {
  throw new Error("Pass a Python script path.");
}

const candidates =
  process.platform === "win32"
    ? [
        path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
        path.join(process.cwd(), ".venv", "Scripts", "python"),
      ]
    : [path.join(process.cwd(), ".venv", "bin", "python")];
const python = candidates.find((candidate) => fs.existsSync(candidate));

if (!python) {
  throw new Error(
    process.platform === "win32"
      ? "Python environment missing. Run ..\\scripts\\setup.ps1 from the repository root."
      : "Python environment missing. Run ../scripts/setup.sh from the repository root.",
  );
}

const forwardedArgs = process.argv.slice(3);
while (forwardedArgs[0] === "--") {
  forwardedArgs.shift();
}

const result = spawnSync(python, [script, ...forwardedArgs], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
