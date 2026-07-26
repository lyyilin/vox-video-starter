import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import {
  allCues,
  assertFile,
  command,
  episodeDir,
  ffprobeDurationMs,
  getArg,
  loadEpisode,
  stitchSceneFrames,
  validateCueUniqueness,
  writeJson,
} from "./lib";
import {
  alignToScript,
  countScriptCharacters,
  countWhisperCharacters,
} from "./alignment";

const main = async (): Promise<void> => {
const id = getArg("--episode");
const episode = loadEpisode(id);
validateCueUniqueness(episode);
const dir = episodeDir(id);
const voiceFile = path.join(dir, "audio", "voice.wav");
assertFile(
  voiceFile,
  `Run pnpm run audio:build -- --episode ${id} before building the timeline.`,
);
const whisperInput = path.join(dir, "audio", "voice-16k.wav");
command("ffmpeg", [
  "-y",
  "-i",
  voiceFile,
  "-ar",
  "16000",
  "-ac",
  "1",
  "-c:a",
  "pcm_s16le",
  whisperInput,
]);

const whisperPath = path.join(
  os.homedir(),
  ".cache",
  "vox-whisper-cpp-1.8.4",
);
const whisperCppVersion = "1.8.4";
console.log(`Ensuring Whisper.cpp ${whisperCppVersion}`);
await installWhisperCpp({
  to: whisperPath,
  version: whisperCppVersion,
  printOutput: true,
});
console.log("Ensuring large-v3-turbo model");
await downloadWhisperModel({
  model: "large-v3-turbo",
  folder: whisperPath,
  printOutput: true,
});

const runtimeDir = path.join(os.homedir(), ".cache", "vox-whisper-runtime");
fs.mkdirSync(runtimeDir, { recursive: true });
const asciiInput = path.join(runtimeDir, `${id}-voice-16k.wav`);
fs.copyFileSync(whisperInput, asciiInput);
const originalCwd = process.cwd();
process.chdir(runtimeDir);
let whisperOutput;
try {
  whisperOutput = await transcribe({
    inputPath: asciiInput,
    whisperPath,
    whisperCppVersion,
    model: "large-v3-turbo",
    language: "zh",
    tokenLevelTimestamps: true,
    splitOnWord: false,
    flashAttention: false,
    additionalArgs: ["--no-flash-attn"],
    printOutput: true,
    onProgress: (progress) =>
      process.stdout.write(`\rWhisper ${(progress * 100).toFixed(1)}%`),
  });
} finally {
  process.chdir(originalCwd);
}
process.stdout.write("\n");
const { captions: rawCaptions } = toCaptions({
  whisperCppOutput: whisperOutput,
});
writeJson(path.join(dir, "whisper-raw.json"), whisperOutput);
writeJson(path.join(dir, "captions-whisper.json"), rawCaptions);

const durationMs = ffprobeDurationMs(voiceFile);
const script = episode.segments.map((segment) => segment.text).join("");
const aligned = alignToScript(script, rawCaptions, durationMs);
const blocked = aligned.unmatchedRatio > 0.1;
writeJson(path.join(dir, "captions.json"), aligned.captions);

const cueMap = Object.fromEntries(
  allCues(episode).map((cue) => {
    const startIndex = script.indexOf(cue);
    const endIndex = startIndex + [...cue].length - 1;
    const first = aligned.captions[startIndex];
    const last = aligned.captions[endIndex];
    if (!first || !last) {
      throw new Error(`Could not resolve cue "${cue}".`);
    }
    return [
      cue,
      {
        startMs: first.startMs,
        endMs: last.endMs,
        frame: Math.floor((first.startMs / 1000) * episode.format.fps),
      },
    ];
  }),
);

const resolvedScenes = stitchSceneFrames(episode.scenes.map((scene) => {
  const start = cueMap[scene.startCue];
  const end = cueMap[scene.endCue];
  const startMs = Math.max(0, start.startMs - 180);
  const endMs = Math.min(durationMs, end.endMs + 520);
  const startFrame = Math.floor((startMs / 1000) * episode.format.fps);
  const endFrame = Math.ceil((endMs / 1000) * episode.format.fps);
  return {
    ...scene,
    startMs,
    endMs,
    startFrame,
    endFrame,
    cameraBeats: scene.cameraBeats.map((beat) => ({
      ...beat,
      cueMs: cueMap[beat.cue].startMs,
      cueFrame: cueMap[beat.cue].frame,
    })),
    routes: scene.routes.map((route) => ({
      ...route,
      cueMs: cueMap[route.cue].startMs,
      cueFrame: cueMap[route.cue].frame,
    })),
    annotations: scene.annotations.map((annotation) => ({
      ...annotation,
      cueMs: cueMap[annotation.cue].startMs,
      cueFrame: cueMap[annotation.cue].frame,
    })),
    layers: scene.layers.map((layer) => ({
      ...layer,
      cueMs: cueMap[layer.cue].startMs,
      cueFrame: cueMap[layer.cue].frame,
      beats: layer.beats.map((beat) => ({
        ...beat,
        cueMs: cueMap[beat.cue].startMs,
        cueFrame: cueMap[beat.cue].frame,
      })),
    })),
  };
}), episode.format.fps);

const resolved = {
  ...episode,
  captionsData: aligned.captions,
  cueMap,
  scenes: resolvedScenes,
  durationMs,
  durationInFrames: Math.ceil((durationMs / 1000) * episode.format.fps),
  alignment: {
    unmatchedRatio: aligned.unmatchedRatio,
    blocked,
    method: "Whisper large-v3-turbo DTW token timestamps + script LCS correction",
  },
};
writeJson(path.join(dir, "resolved-episode.json"), resolved);
writeJson(path.join(dir, "alignment-report.json"), {
  episode: id,
  scriptCharacters: countScriptCharacters(script),
  whisperCharacters: countWhisperCharacters(rawCaptions),
  unmatchedRatio: aligned.unmatchedRatio,
  threshold: 0.1,
  blocked,
});

const manualFile = path.join(dir, "alignment-manual.json");
if (blocked) {
  writeJson(manualFile, {
    instructions:
      "Correct the caption timings or recognition text, then rebuild. Final rendering is blocked while unmatchedRatio exceeds 0.10.",
    rawCaptions,
    alignedCaptions: aligned.captions,
  });
  throw new Error(
    `Alignment unmatched ratio ${(aligned.unmatchedRatio * 100).toFixed(1)}% exceeds 10%. Review ${manualFile}.`,
  );
}
if (fs.existsSync(manualFile)) {
  fs.rmSync(manualFile);
}
console.log(
  `Timeline ready: ${path.join(dir, "resolved-episode.json")} (${(aligned.unmatchedRatio * 100).toFixed(1)}% unmatched)`,
);
};

const keepAlive = setInterval(() => undefined, 1000);
void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
