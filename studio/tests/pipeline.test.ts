import assert from "node:assert/strict";
import test from "node:test";
import type { Caption } from "@remotion/captions";
import { alignToScript, lcsPairs } from "../scripts/alignment";
import { fullNarrationText } from "../scripts/seed-tts2";
import { stitchSceneFrames, validateCueUniqueness } from "../scripts/lib";
import { episodeSchema } from "../src/episode-schema";

const episode = episodeSchema.parse({
  id: "generic-test",
  title: "Generic test",
  brand: { name: "Example Channel", shortMark: "EX" },
  format: { width: 1920, height: 1080, fps: 30 },
  voice: { provider: "seed-tts2" },
  segments: [{ id: "one", sceneId: "scene-one", text: "资源进入节点，然后完成交接。" }],
  scenes: [{
    id: "scene-one",
    title: "One node",
    startCue: "资源进入",
    endCue: "完成交接",
    background: "background.png",
    cameraBeats: [{ cue: "进入节点", motion: "push-in" }],
    routes: [],
    annotations: [],
    layers: [{
      id: "subject",
      asset: "subject.png",
      role: "primary",
      cue: "节点，然后",
      motion: "rise",
      layout: { x: 0.5, y: 0.9, width: 0.3 },
      z: 30,
    }],
  }],
  audio: {
    bgm: { asset: "bgm.mp3", title: "BGM", author: "Author", license: "CC BY 4.0", source: "https://example.com", volume: 0.1 },
    sfx: [],
  },
  captions: { maxCharsPerPage: 14, combineWithinMs: 950, bottomSafeArea: 112 },
});

test("generic episode passes schema and unique cues", () => {
  assert.doesNotThrow(() => validateCueUniqueness(episode));
  assert.equal(episode.brand.shortMark, "EX");
});

test("Seed-TTS input joins the entire narration once", () => {
  assert.equal(fullNarrationText(episode.segments), "资源进入节点，然后完成交接。");
});

test("scene stitching removes gaps", () => {
  const result = stitchSceneFrames([
    { startFrame: 1, endFrame: 100, startMs: 33, sceneTransition: "paper-left" },
    { startFrame: 110, endFrame: 200, startMs: 3666, sceneTransition: "hard-cut" },
  ], 30);
  assert.equal(result[0].startFrame, 0);
  assert.equal(result[1].startFrame, 100);
});

test("alignment corrects recognition to the exact script", () => {
  const script = "节点完成交接";
  const whisper: Caption[] = [{ text: "节点完成交结", startMs: 100, endMs: 1500, timestampMs: 100, confidence: 0.8 }];
  const aligned = alignToScript(script, whisper, 1800);
  assert.equal(aligned.captions.map((caption) => caption.text).join(""), script);
  assert.deepEqual(lcsPairs(["a", "b"], ["a", "x", "b"]), [[0, 0], [1, 2]]);
});
