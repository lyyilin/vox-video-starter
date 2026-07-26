import fs from "node:fs";
import path from "node:path";
import type { Episode } from "../src/episode-schema";
import {
  assertFile,
  command,
  episodeDir,
  getArg,
  loadEpisode,
  validateCueUniqueness,
  writeJson,
} from "./lib";
import { buildSeedTts2Request } from "./seed-tts2";

const BGM_DOWNLOAD =
  "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ripples.mp3";
const DEFAULT_BGM_SOURCE =
  "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100691";

const normalizeNarration = (input: string, output: string): void => {
  command("ffmpeg", [
    "-y",
    "-i",
    input,
    "-af",
    "loudnorm=I=-17:TP=-1.5:LRA=9",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    output,
  ]);
  assertFile(output);
};

const buildSeedNarration = (
  episode: Episode,
  audioDir: string,
  voiceFile: string,
  resume: boolean,
): void => {
  const seed = episode.voice.seedTts2;
  if (!process.env[seed.apiKeyEnv]?.trim()) {
    throw new Error(
      `Seed-TTS 2 API key is missing. Set ${seed.apiKeyEnv} in studio/.env and retry.`,
    );
  }

  const requestFile = path.join(audioDir, "seed-tts2-request.json");
  const rawFile = path.join(audioDir, "voice-seed-tts2.mp3");
  writeJson(requestFile, buildSeedTts2Request(episode));

  if (
    resume &&
    fs.existsSync(rawFile) &&
    fs.statSync(rawFile).size > 1_000 &&
    fs.existsSync(voiceFile) &&
    fs.statSync(voiceFile).size > 1_000
  ) {
    console.log("Reusing the existing full Seed-TTS 2 narration.");
    return;
  }

  console.log(
    `Synthesizing the complete ${episode.segments.length}-segment script with Seed-TTS 2 in one request.`,
  );
  command(process.env.PYTHON ?? "python", [
    path.resolve(seed.adapter),
    `--request=${requestFile}`,
    `--output=${rawFile}`,
  ]);
  assertFile(rawFile, "Seed-TTS 2 did not return an MP3 file.");
  normalizeNarration(rawFile, voiceFile);
};

const buildGptSovitsNarration = async (
  episode: Episode,
  segmentsDir: string,
  voiceFile: string,
  resume: boolean,
): Promise<void> => {
  const baseUrl = (
    process.env.GPT_SOVITS_URL ?? episode.voice.serviceUrl
  ).replace(/\/$/, "");

  const healthResponse = await fetch(`${baseUrl}/health`);
  if (!healthResponse.ok) {
    throw new Error(
      `GPT-SoVITS is not healthy at ${baseUrl}. Start your local API service and retry.`,
    );
  }
  const health = (await healthResponse.json()) as {
    characters?: string[];
    status?: string;
  };
  if (
    !Array.isArray(health.characters) ||
    !health.characters.includes(episode.voice.character)
  ) {
    throw new Error(
      `Voice "${episode.voice.character}" is unavailable. Available voices: ${(health.characters ?? []).join(", ")}`,
    );
  }

  const processedSegments: string[] = [];
  for (const [index, segment] of episode.segments.entries()) {
    const rawFile = path.join(
      segmentsDir,
      `${String(index + 1).padStart(2, "0")}-${segment.id}-raw.wav`,
    );
    const normalizedFile = path.join(
      segmentsDir,
      `${String(index + 1).padStart(2, "0")}-${segment.id}.wav`,
    );

    if (
      resume &&
      fs.existsSync(rawFile) &&
      fs.statSync(rawFile).size > 1_000 &&
      fs.existsSync(normalizedFile) &&
      fs.statSync(normalizedFile).size > 1_000
    ) {
      console.log(`Reusing ${segment.id}`);
      processedSegments.push(normalizedFile);
      continue;
    }

    console.log(`Synthesizing ${segment.id} with ${episode.voice.character}`);
    const useServerVoicePreset =
      episode.voice.character === "讲故事" ||
      episode.voice.character.toLowerCase() === "story";
    const samplingParameters = useServerVoicePreset
      ? {}
      : {
          speed: episode.voice.speed,
          top_k: episode.voice.topK,
          top_p: episode.voice.topP,
          temperature: episode.voice.temperature,
        };
    const response = await fetch(`${baseUrl}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        character: episode.voice.character,
        text: segment.text,
        text_language: "zh",
        ...samplingParameters,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `TTS failed for ${segment.id}: ${response.status} ${await response.text()}`,
      );
    }
    fs.writeFileSync(rawFile, Buffer.from(await response.arrayBuffer()));
    assertFile(rawFile, "The TTS endpoint did not return a WAV file.");

    command("ffmpeg", [
      "-y",
      "-i",
      rawFile,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      normalizedFile,
    ]);
    processedSegments.push(normalizedFile);
  }

  const makeSilence = (name: string, duration: number): string => {
    const target = path.join(segmentsDir, name);
    command("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-t",
      String(duration),
      "-c:a",
      "pcm_s16le",
      target,
    ]);
    return target;
  };

  const lead = makeSilence("00-lead.wav", 0.4);
  const gap = makeSilence("gap.wav", 0.24);
  const tail = makeSilence("99-tail.wav", 0.65);
  const concatItems = [
    lead,
    ...processedSegments.flatMap((file, index) =>
      index === processedSegments.length - 1 ? [file] : [file, gap],
    ),
    tail,
  ];
  const concatFile = path.join(segmentsDir, "concat.txt");
  const escapeConcatPath = (file: string): string =>
    file.replace(/\\/g, "/").replace(/'/g, "'\\''");
  fs.writeFileSync(
    concatFile,
    concatItems.map((file) => `file '${escapeConcatPath(file)}'`).join("\n"),
    "utf8",
  );

  command("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-af",
    "loudnorm=I=-17:TP=-1.5:LRA=9",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    voiceFile,
  ]);
  assertFile(voiceFile);
};

const ensureBgmAndSfx = async (episode: Episode, dir: string): Promise<void> => {
  const audioDir = path.join(dir, "audio");
  const sfxDir = path.join(audioDir, "sfx");
  const bgmFile = path.join(audioDir, "bgm.mp3");
  if (!fs.existsSync(bgmFile) || fs.statSync(bgmFile).size < 1_000_000) {
    const usesBundledDefault =
      episode.audio.bgm.title === "Ripples" &&
      episode.audio.bgm.author === "Kevin MacLeod" &&
      episode.audio.bgm.source === DEFAULT_BGM_SOURCE;
    if (!usesBundledDefault) {
      throw new Error(
        `Custom BGM is missing at ${bgmFile}. Add the licensed file there or restore the default Ripples metadata.`,
      );
    }

    console.log("Downloading CC BY 4.0 BGM: Ripples by Kevin MacLeod");
    const response = await fetch(BGM_DOWNLOAD);
    if (!response.ok) {
      throw new Error(
        `BGM download failed: ${response.status} ${response.statusText}`,
      );
    }
    const temporaryFile = `${bgmFile}.part`;
    fs.writeFileSync(temporaryFile, Buffer.from(await response.arrayBuffer()));
    fs.renameSync(temporaryFile, bgmFile);
  }
  assertFile(bgmFile);

  const sfxFilters: Record<string, { input: string; filter: string }> = {
    whoosh: {
      input: "anoisesrc=color=pink:duration=0.65:sample_rate=48000",
      filter:
        "highpass=f=240,lowpass=f=6200,volume=0.32,afade=t=in:st=0:d=0.06,afade=t=out:st=0.42:d=0.23",
    },
    page: {
      input: "anoisesrc=color=brown:duration=0.48:sample_rate=48000",
      filter:
        "highpass=f=900,lowpass=f=7200,tremolo=f=12:d=0.45,volume=0.26,afade=t=in:st=0:d=0.025,afade=t=out:st=0.28:d=0.20",
    },
    impact: {
      input: "sine=frequency=92:duration=0.52:sample_rate=48000",
      filter:
        "volume=0.52,lowpass=f=650,afade=t=out:st=0.10:d=0.42",
    },
    tick: {
      input: "sine=frequency=1320:duration=0.12:sample_rate=48000",
      filter: "volume=0.20,afade=t=out:st=0.025:d=0.095",
    },
  };

  for (const [name, spec] of Object.entries(sfxFilters)) {
    command("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      spec.input,
      "-af",
      spec.filter,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      path.join(sfxDir, `${name}.wav`),
    ]);
  }

  const credits = `"${episode.audio.bgm.title}" by ${episode.audio.bgm.author}
License: ${episode.audio.bgm.license}
Source: ${episode.audio.bgm.source}

Sound effects were generated procedurally with FFmpeg for this project.
`;
  fs.writeFileSync(path.join(dir, "credits.md"), credits, "utf8");
};

const main = async (): Promise<void> => {
  const id = getArg("--episode");
  const resume = process.argv.includes("--resume");
  const envFile = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const episode = loadEpisode(id);
  validateCueUniqueness(episode);
  const dir = episodeDir(id);
  const audioDir = path.join(dir, "audio");
  const segmentsDir = path.join(audioDir, "segments");
  const sfxDir = path.join(audioDir, "sfx");
  fs.mkdirSync(segmentsDir, { recursive: true });
  fs.mkdirSync(sfxDir, { recursive: true });

  const voiceFile = path.join(audioDir, "voice.wav");
  if (episode.voice.provider === "seed-tts2") {
    buildSeedNarration(episode, audioDir, voiceFile, resume);
  } else {
    await buildGptSovitsNarration(
      episode,
      segmentsDir,
      voiceFile,
      resume,
    );
  }

  await ensureBgmAndSfx(episode, dir);
  console.log(`Audio ready: ${voiceFile}`);
};

const keepAlive = setInterval(() => undefined, 1000);
void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
