import fs from "node:fs";
import path from "node:path";
import { episodeDir, getArg, writeJson } from "./lib";

const id = getArg("--id");
if (!/^[a-z0-9-]+$/.test(id)) {
  throw new Error("Episode id must contain only lowercase letters, digits, and hyphens.");
}

const dir = episodeDir(id);
const episodeFile = path.join(dir, "episode.json");
if (fs.existsSync(episodeFile)) {
  throw new Error(`Episode already exists: ${episodeFile}`);
}

const assetBase = `episodes/${id}`;
writeJson(episodeFile, {
  id,
  title: "New VOX collage episode",
  brand: {
    name: "My VOX Channel",
    shortMark: "VOX",
  },
  format: { width: 1920, height: 1080, fps: 30 },
  voice: {
    provider: "seed-tts2",
    seedTts2: {
      apiKeyEnv: "VOLCENGINE_SPEECH_API_KEY",
      adapter: "scripts/local/volcengine_tts_adapter.py",
      model: "seed-tts-2.0",
      voiceId: "zh_male_ruyayichen_uranus_bigtts",
      settings: {
        format: "mp3",
        sampleRate: 24000,
        bitRate: 128000,
        speedRatio: 0.94,
        pitch: -1,
        performancePrompt:
          "像一位自然、可信、善于讲故事的旁白者。表达清楚，有画面感但不过度表演；重点词轻微强调，句间停顿自然。不要新闻播音腔，不要广告腔。",
      },
    },
    character: "story",
    serviceUrl: "http://127.0.0.1:9880",
    speed: 1,
    topK: 5,
    topP: 1,
    temperature: 1,
  },
  segments: [
    {
      id: "segment-01",
      sceneId: "scene-01",
      text: "把第一段逐字稿写在这里，并确保所有动画提示词只出现一次。",
    },
  ],
  scenes: [
    {
      id: "scene-01",
      title: "Scene title",
      kicker: "Chapter 01",
      startCue: "把第一段",
      endCue: "一次。",
      background: `${assetBase}/assets/backgrounds/scene-01.png`,
      sceneTransition: "paper-left",
      motionIntensity: 1.15,
      cameraBeats: [
        {
          cue: "所有提示词",
          motion: "push-in",
          strength: 1,
        },
      ],
      routes: [],
      annotations: [
        {
          id: "chapter-label",
          cue: "确保所有提示词",
          text: "Key point",
          type: "label",
          tone: "bronze",
          motion: "slide-right",
          x: 0.72,
          y: 0.28,
          z: 82,
        },
      ],
      layers: [
        {
          id: "subject-01",
          asset: `${assetBase}/assets/matted/subject-01.png`,
          role: "primary",
          cue: "逐字稿",
          motion: "rise",
          ambient: "sway",
          exit: "slide-left",
          beats: [
            {
              cue: "写在这里",
              effect: "lift",
              strength: 1,
            },
          ],
          layout: {
            x: 0.68,
            y: 0.86,
            width: 0.34,
            rotation: 0,
            anchor: "bottom",
            depth: 1.2,
          },
          z: 30,
        },
      ],
    },
  ],
  audio: {
    bgm: {
      asset: `${assetBase}/audio/bgm.mp3`,
      title: "Ripples",
      author: "Kevin MacLeod",
      license: "CC BY 4.0",
      source:
        "https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100691",
      volume: 0.12,
    },
    sfx: [
      {
        id: "paper-in",
        type: "page",
        cue: "确保",
        volume: 0.28,
      },
    ],
  },
  captions: {
    maxCharsPerPage: 14,
    combineWithinMs: 1050,
    bottomSafeArea: 112,
  },
});

for (const relative of [
  "assets/source",
  "assets/backgrounds",
  "assets/matted",
  "audio/segments",
  "audio/sfx",
  "prompts",
  "review",
]) {
  fs.mkdirSync(path.join(dir, relative), { recursive: true });
}

console.log(`Created ${episodeFile}`);
console.log("Next: write the script and storyboard, then review episode.json before generating assets.");
