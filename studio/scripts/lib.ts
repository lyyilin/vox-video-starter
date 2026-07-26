import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { episodeSchema, type Episode } from "../src/episode-schema";

export const projectRoot = process.cwd();
export const publicRoot = path.join(projectRoot, "public");

export const getArg = (name: string, fallback?: string): string => {
  const equals = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (equals) {
    return equals.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value && !value.startsWith("--")) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required argument ${name}`);
};

export const episodeDir = (id: string): string =>
  path.join(publicRoot, "episodes", id);

type FrameBoundScene = {
  startFrame: number;
  endFrame: number;
  startMs: number;
  sceneTransition: string;
};

export const stitchSceneFrames = <T extends FrameBoundScene>(
  scenes: T[],
  fps: number,
  crossfadeSeconds = 0.23,
): T[] => {
  const stitched = scenes.map((scene) => ({ ...scene }));
  if (stitched.length === 0) return stitched;

  stitched[0].startFrame = 0;
  stitched[0].startMs = 0;
  const crossfadeFrames = Math.max(5, Math.round(fps * crossfadeSeconds));

  for (let index = 1; index < stitched.length; index++) {
    const previous = stitched[index - 1];
    const current = stitched[index];
    const targetStart =
      current.sceneTransition === "hard-cut"
        ? previous.endFrame
        : previous.endFrame - crossfadeFrames;

    if (current.startFrame > targetStart) {
      current.startFrame = Math.max(0, targetStart);
      current.startMs = (current.startFrame / fps) * 1000;
    }
  }

  return stitched;
};

export const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8")) as T;

export const writeJson = (file: string, value: unknown): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const loadEpisode = (id: string): Episode => {
  const file = path.join(episodeDir(id), "episode.json");
  if (!fs.existsSync(file)) {
    throw new Error(`Episode not found: ${file}`);
  }
  return episodeSchema.parse(readJson(file));
};

export const allCues = (episode: Episode): string[] => [
  ...episode.scenes.flatMap((scene) => [
    scene.startCue,
    scene.endCue,
    ...scene.cameraBeats.map((beat) => beat.cue),
    ...scene.routes.map((route) => route.cue),
    ...scene.annotations.map((annotation) => annotation.cue),
    ...scene.layers.map((layer) => layer.cue),
    ...scene.layers.flatMap((layer) => layer.beats.map((beat) => beat.cue)),
  ]),
  ...episode.audio.sfx.map((sfx) => sfx.cue),
];

export const validateCueUniqueness = (episode: Episode): void => {
  const script = episode.segments.map((segment) => segment.text).join("");
  const duplicateDefinitions = allCues(episode).filter(
    (cue, index, cues) => cues.indexOf(cue) !== index,
  );

  if (duplicateDefinitions.length > 0) {
    throw new Error(
      `Cue values must be unique in episode.json: ${[...new Set(duplicateDefinitions)].join(", ")}`,
    );
  }

  for (const cue of allCues(episode)) {
    const first = script.indexOf(cue);
    const last = script.lastIndexOf(cue);
    if (first < 0) {
      throw new Error(`Cue "${cue}" is not present in the script.`);
    }
    if (first !== last) {
      throw new Error(`Cue "${cue}" occurs more than once in the script.`);
    }
  }

  const sceneIds = new Set(episode.scenes.map((scene) => scene.id));
  for (const segment of episode.segments) {
    if (!sceneIds.has(segment.sceneId)) {
      throw new Error(
        `Segment "${segment.id}" references unknown scene "${segment.sceneId}".`,
      );
    }
  }
};

export const command = (
  executable: string,
  args: string[],
  options: {
    cwd?: string;
    capture?: boolean;
    captureStderr?: boolean;
  } = {},
): string => {
  const needsWindowsCommandShell =
    process.platform === "win32" && executable.toLowerCase().endsWith(".cmd");
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: needsWindowsCommandShell,
  });

  if (result.status !== 0) {
    const detail = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");
    throw new Error(
      `${executable} ${args.join(" ")} failed with code ${result.status}.${detail ? `\n${detail}` : ""}`,
    );
  }

  return options.captureStderr ? (result.stderr ?? "") : (result.stdout ?? "");
};

export const ffprobeDurationMs = (file: string): number => {
  const output = command(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { capture: true },
  );
  const seconds = Number(output.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read duration for ${file}`);
  }
  return seconds * 1000;
};

export const assertFile = (file: string, hint?: string): void => {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`${file} is missing or empty.${hint ? ` ${hint}` : ""}`);
  }
};
