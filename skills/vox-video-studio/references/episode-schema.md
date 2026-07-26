# Episode interface

Store the editable source at `studio/public/episodes/<slug>/episode.json`.

Top-level fields:

- `id`, `title`, `brand`, fixed `format` (1920×1080, 30fps)
- `voice`: Seed-TTS 2 or explicitly configured GPT-SoVITS settings
- `segments[]`: script segments joined into one narration request
- `scenes[]`: caption-bounded scenes
- `audio`: licensed BGM metadata and caption-triggered procedural SFX
- `captions`: pagination and safe-area settings

Each scene may contain camera beats, routes, annotations, and independent layers. Every cue string must appear exactly once in the complete joined script and may not duplicate another cue value.

`timeline:build` generates `captions-whisper.json`, corrected `captions.json`, `alignment-report.json`, and read-only `resolved-episode.json`. Change the source JSON and rebuild instead of editing generated timing files.
