import { z } from "zod";

export const cueSchema = z.string().min(1);

const DEFAULT_SEED_TTS2_PROMPT =
  "像一位自然、可信、善于讲故事的旁白者。表达清楚，有画面感但不过度表演；重点词轻微强调，句间停顿自然。不要新闻播音腔，不要广告腔。";

const DEFAULT_SEED_TTS2_SETTINGS = {
  format: "mp3" as const,
  sampleRate: 24000 as const,
  bitRate: 128000,
  speedRatio: 0.94,
  pitch: -1,
  performancePrompt: DEFAULT_SEED_TTS2_PROMPT,
};

const DEFAULT_SEED_TTS2 = {
  apiKeyEnv: "VOLCENGINE_SPEECH_API_KEY",
  adapter: "scripts/local/volcengine_tts_adapter.py",
  model: "seed-tts-2.0" as const,
  voiceId: "zh_male_ruyayichen_uranus_bigtts",
  settings: DEFAULT_SEED_TTS2_SETTINGS,
};

export const formatSchema = z.object({
  width: z.literal(1920),
  height: z.literal(1080),
  fps: z.literal(30),
});

export const brandSchema = z.object({
  name: z.string().min(1).default("My VOX Channel"),
  shortMark: z.string().min(1).max(6).default("VOX"),
});

const seedTts2SettingsSchema = z.object({
  format: z.literal("mp3").default("mp3"),
  sampleRate: z
    .union([
      z.literal(8000),
      z.literal(16000),
      z.literal(22050),
      z.literal(24000),
      z.literal(32000),
      z.literal(44100),
      z.literal(48000),
    ])
    .default(24000),
  bitRate: z.number().int().min(64000).max(160000).default(128000),
  speedRatio: z.number().min(0.5).max(2).default(0.94),
  pitch: z.number().int().min(-12).max(12).default(-1),
  performancePrompt: z
    .string()
    .min(1)
    .default(DEFAULT_SEED_TTS2_PROMPT),
});

const seedTts2Schema = z.object({
  apiKeyEnv: z.string().min(1).default("VOLCENGINE_SPEECH_API_KEY"),
  adapter: z
    .string()
    .min(1)
    .default("scripts/local/volcengine_tts_adapter.py"),
  model: z.literal("seed-tts-2.0").default("seed-tts-2.0"),
  voiceId: z
    .string()
    .min(1)
    .default("zh_male_ruyayichen_uranus_bigtts"),
  settings: seedTts2SettingsSchema.default(DEFAULT_SEED_TTS2_SETTINGS),
});

export const voiceSchema = z.object({
  provider: z.enum(["gpt-sovits", "seed-tts2"]).default("seed-tts2"),
  seedTts2: seedTts2Schema.default(DEFAULT_SEED_TTS2),
  character: z.string().min(1).default("story"),
  serviceUrl: z.string().url().default("http://127.0.0.1:9880"),
  speed: z.number().positive().default(1),
  topK: z.number().int().positive().default(5),
  topP: z.number().min(0).max(1).default(1),
  temperature: z.number().positive().default(1),
});

export const segmentSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  text: z.string().min(1),
});

export const layoutSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1.5),
  rotation: z.number().min(-45).max(45).default(0),
  anchor: z.enum(["center", "bottom"]).default("bottom"),
  depth: z.number().min(0).max(2).default(1),
});

export const layerBeatSchema = z.object({
  cue: cueSchema,
  effect: z.enum([
    "pulse",
    "tilt",
    "lift",
    "nudge-left",
    "nudge-right",
    "focus",
    "shake",
    "bounce",
    "swing",
    "flash",
    "dim",
  ]),
  strength: z.number().min(0.25).max(2).default(1),
});

export const cameraBeatSchema = z.object({
  cue: cueSchema,
  motion: z.enum([
    "push-in",
    "pull-out",
    "pan-left",
    "pan-right",
    "whip-left",
    "whip-right",
    "lift",
    "drop",
    "tilt-left",
    "tilt-right",
  ]),
  strength: z.number().min(0.25).max(2).default(1),
});

export const layerSchema = z.object({
  id: z.string().min(1),
  asset: z.string().min(1),
  role: z.enum(["primary", "secondary", "tertiary", "foreground"]),
  cue: cueSchema,
  motion: z.enum([
    "slide-left",
    "slide-right",
    "rise",
    "pop",
    "drift",
    "stamp",
  ]),
  ambient: z
    .enum(["none", "breathe", "sway", "float", "pendulum"])
    .default("breathe"),
  exit: z
    .enum(["fade", "slide-left", "slide-right", "drop", "shrink"])
    .default("fade"),
  beats: z.array(layerBeatSchema).default([]),
  layout: layoutSchema,
  z: z.number().int(),
});

export const routePointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const routeSchema = z.object({
  id: z.string().min(1),
  cue: cueSchema,
  points: z.array(routePointSchema).min(2),
  tone: z.enum(["bronze", "cinnabar", "mist"]).default("bronze"),
  style: z.enum(["solid", "dashed"]).default("solid"),
  direction: z.enum(["forward", "reverse"]).default("forward"),
  width: z.number().min(2).max(20).default(6),
  z: z.number().int().default(20),
});

export const annotationSchema = z.object({
  id: z.string().min(1),
  cue: cueSchema,
  text: z.string().min(1).max(24),
  type: z.enum(["label", "counter", "warning", "stamp"]).default("label"),
  tone: z.enum(["paper", "bronze", "cinnabar", "mist"]).default("paper"),
  motion: z.enum(["pop", "slide-left", "slide-right", "stamp"]).default("pop"),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  z: z.number().int().default(80),
});

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kicker: z.string().optional(),
  titleTone: z.enum(["ink", "paper"]).default("ink"),
  startCue: cueSchema,
  endCue: cueSchema,
  background: z.string().min(1),
  sceneTransition: z
    .enum(["paper-left", "paper-right", "paper-up", "ink-cut", "hard-cut"])
    .default("paper-left"),
  motionIntensity: z.number().min(0.5).max(2).default(1),
  cameraBeats: z.array(cameraBeatSchema).default([]),
  routes: z.array(routeSchema).default([]),
  annotations: z.array(annotationSchema).default([]),
  layers: z.array(layerSchema),
});

export const sfxSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["page", "whoosh", "impact", "tick"]),
  cue: cueSchema,
  volume: z.number().min(0).max(1).default(0.35),
});

export const episodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  brand: brandSchema.default({ name: "My VOX Channel", shortMark: "VOX" }),
  format: formatSchema,
  voice: voiceSchema,
  segments: z.array(segmentSchema).min(1),
  scenes: z.array(sceneSchema).min(1),
  audio: z.object({
    bgm: z.object({
      asset: z.string().min(1),
      title: z.string().min(1),
      author: z.string().min(1),
      license: z.string().min(1),
      source: z.string().url(),
      volume: z.number().min(0).max(1),
    }),
    sfx: z.array(sfxSchema),
  }),
  captions: z.object({
    maxCharsPerPage: z.number().int().min(4).max(24),
    combineWithinMs: z.number().int().min(200).max(3000),
    bottomSafeArea: z.number().int().min(80).max(260),
  }),
});

export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

export const resolvedLayerBeatSchema = layerBeatSchema.extend({
  cueMs: z.number().nonnegative(),
  cueFrame: z.number().int().nonnegative(),
});

export const resolvedCameraBeatSchema = cameraBeatSchema.extend({
  cueMs: z.number().nonnegative(),
  cueFrame: z.number().int().nonnegative(),
});

export const resolvedRouteSchema = routeSchema.extend({
  cueMs: z.number().nonnegative(),
  cueFrame: z.number().int().nonnegative(),
});

export const resolvedAnnotationSchema = annotationSchema.extend({
  cueMs: z.number().nonnegative(),
  cueFrame: z.number().int().nonnegative(),
});

export const resolvedLayerSchema = layerSchema
  .omit({ beats: true })
  .extend({
    cueMs: z.number().nonnegative(),
    cueFrame: z.number().int().nonnegative(),
    beats: z.array(resolvedLayerBeatSchema).default([]),
  });

export const resolvedSceneSchema = sceneSchema
  .omit({
    layers: true,
    cameraBeats: true,
    routes: true,
    annotations: true,
  })
  .extend({
    startMs: z.number().nonnegative(),
    endMs: z.number().positive(),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    cameraBeats: z.array(resolvedCameraBeatSchema).default([]),
    routes: z.array(resolvedRouteSchema).default([]),
    annotations: z.array(resolvedAnnotationSchema).default([]),
    layers: z.array(resolvedLayerSchema),
  });

export const resolvedEpisodeSchema = episodeSchema
  .omit({ scenes: true })
  .extend({
    captionsData: z.array(captionSchema),
    cueMap: z.record(
      z.string(),
      z.object({
        startMs: z.number().nonnegative(),
        endMs: z.number().nonnegative(),
        frame: z.number().int().nonnegative(),
      }),
    ),
    scenes: z.array(resolvedSceneSchema),
    durationMs: z.number().positive(),
    durationInFrames: z.number().int().positive(),
    alignment: z.object({
      unmatchedRatio: z.number().min(0).max(1),
      blocked: z.boolean(),
      method: z.string(),
    }),
  });

export type Episode = z.infer<typeof episodeSchema>;
export type ResolvedEpisode = z.infer<typeof resolvedEpisodeSchema>;
export type ResolvedLayer = z.infer<typeof resolvedLayerSchema>;
export type ResolvedScene = z.infer<typeof resolvedSceneSchema>;
export type ResolvedRoute = z.infer<typeof resolvedRouteSchema>;
export type ResolvedAnnotation = z.infer<typeof resolvedAnnotationSchema>;
