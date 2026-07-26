import type { Episode } from "../src/episode-schema";

export type SeedTts2Request = {
  capability: "voice";
  assetId: string;
  text: string;
  model: "seed-tts-2.0";
  voiceId: string;
  settings: Episode["voice"]["seedTts2"]["settings"];
};

export const fullNarrationText = (
  segments: Episode["segments"],
): string => segments.map((segment) => segment.text.trim()).join("\n");

export const buildSeedTts2Request = (
  episode: Episode,
): SeedTts2Request => ({
  capability: "voice",
  assetId: `${episode.id}-full-narration`,
  text: fullNarrationText(episode.segments),
  model: episode.voice.seedTts2.model,
  voiceId: episode.voice.seedTts2.voiceId,
  settings: episode.voice.seedTts2.settings,
});
