import fs from "node:fs";
import path from "node:path";
import {
  allCues,
  assertFile,
  command,
  episodeDir,
  getArg,
  loadEpisode,
  readJson,
  validateCueUniqueness,
  writeJson,
} from "./lib";
import { resolvedEpisodeSchema } from "../src/episode-schema";

const id = getArg("--episode");
const episode = loadEpisode(id);
validateCueUniqueness(episode);
const dir = episodeDir(id);
const resolvedFile = path.join(dir, "resolved-episode.json");
assertFile(resolvedFile);
const resolved = resolvedEpisodeSchema.parse(readJson(resolvedFile));

for (let index = 1; index < resolved.captionsData.length; index++) {
  const previous = resolved.captionsData[index - 1];
  const current = resolved.captionsData[index];
  if (current.startMs < previous.startMs || current.endMs <= current.startMs) {
    throw new Error(`Caption timing is invalid at index ${index}.`);
  }
}

for (const cue of allCues(episode)) {
  if (!resolved.cueMap[cue]) {
    throw new Error(`Resolved timeline is missing cue "${cue}".`);
  }
}

const matteReportFile = path.join(dir, "assets", "matte-report.json");
assertFile(matteReportFile);
const matteReport = readJson<{
  passed: boolean;
  assets: { output: string; ok: boolean; coverage: number }[];
}>(matteReportFile);
if (!matteReport.passed || matteReport.assets.some((asset) => !asset.ok)) {
  throw new Error("Matte QA failed. Review assets/matte-report.json.");
}

for (const scene of resolved.scenes) {
  if (scene.endFrame <= scene.startFrame) {
    throw new Error(`Scene "${scene.id}" has a non-positive duration.`);
  }
  assertFile(path.join("public", scene.background));
  for (const layer of scene.layers) {
    assertFile(path.join("public", layer.asset));
  }
}

const outDir = path.join(process.cwd(), "out", id);
const finalFile = path.join(outDir, `${id}-final-1920x1080.mp4`);
const previewFile = path.join(outDir, `${id}-preview-960x540.mp4`);
const isFinal = fs.existsSync(finalFile);
const mediaFile = isFinal ? finalFile : previewFile;
assertFile(mediaFile, `Render a preview or final for ${id} first.`);
const probeJson = command(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    mediaFile,
  ],
  { capture: true },
);
const probe = JSON.parse(probeJson) as {
  streams: {
    codec_type: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    sample_rate?: string;
    channels?: number;
  }[];
  format: { duration?: string };
};
const videoStream = probe.streams.find((stream) => stream.codec_type === "video");
const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
const expectedWidth = isFinal ? 1920 : 960;
const expectedHeight = isFinal ? 1080 : 540;
if (
  !videoStream ||
  videoStream.width !== expectedWidth ||
  videoStream.height !== expectedHeight ||
  videoStream.r_frame_rate !== "30/1"
) {
  throw new Error(
    `Unexpected video stream: ${JSON.stringify(videoStream)}; expected ${expectedWidth}x${expectedHeight} at 30fps.`,
  );
}
if (!audioStream) {
  throw new Error("Rendered video is missing its audio stream.");
}
if (
  audioStream.codec_name !== "aac" ||
  audioStream.sample_rate !== "48000" ||
  audioStream.channels !== 2
) {
  throw new Error(
    `Unexpected audio stream: ${JSON.stringify(audioStream)}; expected stereo AAC at 48kHz.`,
  );
}

const loudnessOutput = command(
  "ffmpeg",
  [
    "-hide_banner",
    "-nostats",
    "-i",
    mediaFile,
    "-vn",
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    process.platform === "win32" ? "NUL" : "/dev/null",
  ],
  { capture: true, captureStderr: true },
);
const loudnessJson = loudnessOutput.match(
  /\{\s*"input_i"\s*:[\s\S]*?"target_offset"\s*:\s*"[^"]+"\s*\}/u,
)?.[0];
if (!loudnessJson) {
  throw new Error("Could not parse FFmpeg loudness analysis.");
}
const loudness = JSON.parse(loudnessJson) as {
  input_i: string;
  input_tp: string;
  input_lra: string;
};
const integratedLufs = Number(loudness.input_i);
const truePeakDbtp = Number(loudness.input_tp);
const loudnessRangeLu = Number(loudness.input_lra);
if (
  isFinal &&
  (Math.abs(integratedLufs + 14) > 0.5 || truePeakDbtp > -1.3)
) {
  throw new Error(
    `Final loudness is outside tolerance: ${integratedLufs} LUFS, ${truePeakDbtp} dBTP.`,
  );
}

const contactSheet = path.join(outDir, `${id}-contact-sheet.jpg`);
command("ffmpeg", [
  "-y",
  "-i",
  mediaFile,
  "-vf",
  "fps=1/4,scale=480:-1,tile=4x2",
  "-frames:v",
  "1",
  contactSheet,
]);
assertFile(contactSheet);

const report = {
  episode: id,
  passed: true,
  alignmentUnmatchedRatio: resolved.alignment.unmatchedRatio,
  durationSeconds: Number(probe.format.duration ?? 0),
  video: {
    width: videoStream.width,
    height: videoStream.height,
    frameRate: videoStream.r_frame_rate,
  },
  audio: {
    codec: audioStream.codec_name,
    sampleRate: Number(audioStream.sample_rate),
    channels: audioStream.channels,
    integratedLufs,
    truePeakDbtp,
    loudnessRangeLu,
  },
  cueCount: Object.keys(resolved.cueMap).length,
  matteAssetCount: matteReport.assets.length,
  mediaFile,
  contactSheet,
};
writeJson(path.join(outDir, "qa-report.json"), report);
console.log(JSON.stringify(report, null, 2));
