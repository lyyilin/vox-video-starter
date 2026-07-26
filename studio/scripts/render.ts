import fs from "node:fs";
import path from "node:path";
import { assertFile, command, episodeDir, getArg, readJson } from "./lib";
import { resolvedEpisodeSchema } from "../src/episode-schema";

const mode = process.argv[2];
if (mode !== "preview" && mode !== "final") {
  throw new Error("Usage: tsx scripts/render.ts <preview|final> --episode <slug>");
}

const id = getArg("--episode");
const dir = episodeDir(id);
const resolvedFile = path.join(dir, "resolved-episode.json");
assertFile(
  resolvedFile,
  `Run pnpm run timeline:build -- --episode ${id} first.`,
);
const episode = resolvedEpisodeSchema.parse(readJson(resolvedFile));
if (episode.alignment.blocked) {
  throw new Error(
    `Final-quality rendering is blocked because alignment unmatchedRatio is ${(episode.alignment.unmatchedRatio * 100).toFixed(1)}%.`,
  );
}

const missingAssets = [
  ...episode.scenes.map((scene) => scene.background),
  ...episode.scenes.flatMap((scene) =>
    scene.layers.map((layer) => layer.asset),
  ),
].filter((asset) => !fs.existsSync(path.join("public", asset)));
if (missingAssets.length > 0) {
  throw new Error(`Missing render assets:\n${missingAssets.join("\n")}`);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const outDir = path.join(process.cwd(), "out", id);
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, "render-props.json");
fs.writeFileSync(
  propsFile,
  `${JSON.stringify({ episodeId: id, resolved: null }, null, 2)}\n`,
  "utf8",
);
const propsArg = `--props=${propsFile}`;

if (mode === "preview") {
  const previewFile = path.join(outDir, `${id}-preview-960x540.mp4`);
  command(pnpm, [
    "exec",
    "remotion",
    "render",
    "src/index.ts",
    "VoxCollage",
    previewFile,
    propsArg,
    "--scale=0.5",
    "--codec=h264",
    "--crf=28",
    "--audio-bitrate=128k",
    "--concurrency=2",
    "--timeout=300000",
  ]);

  for (const scene of episode.scenes) {
    const middle = Math.floor((scene.startFrame + scene.endFrame) / 2);
    command(pnpm, [
      "exec",
      "remotion",
      "still",
      "src/index.ts",
      "VoxCollage",
      path.join(outDir, `${scene.id}.jpg`),
      propsArg,
      `--frame=${middle}`,
      "--scale=0.5",
      "--image-format=jpeg",
      "--timeout=300000",
    ]);
  }
  console.log(`Preview ready: ${previewFile}`);
  console.log(
    `Review it, then approve by creating ${path.join(dir, "review", "preview-approved.txt")}.`,
  );
} else {
  const approval = path.join(dir, "review", "preview-approved.txt");
  assertFile(
    approval,
    "The low-resolution preview must be explicitly approved before final rendering.",
  );
  const rawFile = path.join(outDir, `${id}-final-raw.mp4`);
  const finalFile = path.join(outDir, `${id}-final-1920x1080.mp4`);
  command(pnpm, [
    "exec",
    "remotion",
    "render",
    "src/index.ts",
    "VoxCollage",
    rawFile,
    propsArg,
    "--codec=h264",
    "--crf=17",
    "--audio-bitrate=320k",
    "--concurrency=2",
    "--timeout=300000",
  ]);
  command("ffmpeg", [
    "-y",
    "-i",
    rawFile,
    "-c:v",
    "copy",
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:a",
    "aac",
    "-b:a",
    "320k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    finalFile,
  ]);
  assertFile(finalFile);
  console.log(`Final ready: ${finalFile}`);
}
