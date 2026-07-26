---
name: vox-video-studio
description: Configure a creator's own content direction and produce reusable VOX-style paper-collage videos with research, approved scripts and storyboards, built-in Imagegen assets, rembg mattes, whole-script TTS, Whisper-aligned captions, caption-driven Remotion animation, preview approval, QA, and final MP4 delivery. Use when a user wants to set up this repository, define a channel profile, create topics or scripts, or build an end-to-end VOX collage video.
---

# VOX Video Studio

Use the repository's `studio/` as the execution project. Treat the user's confirmed content profile as the editorial source of truth and `episode.json` as the technical source of truth.

## Read the relevant references

- For first use or profile changes, read [references/content-onboarding.md](references/content-onboarding.md).
- Before environment work, read [references/environment.md](references/environment.md).
- Before creating an episode, read [references/production-workflow.md](references/production-workflow.md) and [references/episode-schema.md](references/episode-schema.md).
- Before asset generation, read [references/visual-language.md](references/visual-language.md) and [references/asset-orchestration.md](references/asset-orchestration.md).

## Enforce onboarding before production

Check `studio/config/content-profile.md` first. If it is absent, incomplete, or unconfirmed:

1. Ask at most three short grouped questions per round.
2. Learn the channel position, audience, topic territories, evidence standard, narration voice, visual direction, exclusions, platform, duration, and approval phrases.
3. Draft `studio/config/content-profile.md` from the answers.
4. Show the complete profile and pause for the user's explicit direction confirmation.

Do not research a topic, write a final script, generate assets, call TTS, or render until the content direction is confirmed. Never import a bundled creator identity or private account bible.

## Run the episode workflow

1. Convert the topic into one precise operational or causal question that fits the confirmed profile.
2. Research to the profile's evidence standard. Separate confirmed facts, inference, dispute, and unknowns.
3. Save `topic-brief.md`, `research-ledger.md`, `script.md`, and `storyboard.md` under `studio/public/episodes/<slug>/`.
4. Make every spoken sentence visualizable and map it to a scene, focal subject, supporting action, information beat, and failure/cost where relevant.
5. Present the complete script and storyboard, then pause for explicit storyboard approval. Do not generate assets before approval.
6. Create and validate `episode.json`; make every cue unique in the complete joined script.
7. Generate exactly one overview grid in the main task. Delegate every individual background and cutout to a separate worker assignment, one asset per assignment.
8. Run matting, whole-script narration, Whisper alignment, preview render, and QA in that order.
9. Present the 960×540 preview, scene stills, contact sheet, and QA. Pause for explicit preview approval.
10. Record approval, render 1920×1080, normalize the final mix, run QA again, and deliver all artifacts.

## Preserve timing integrity

- Synthesize the joined narration in one TTS request for providers that support it.
- Treat `captions.json` as the timing source for scenes, layers, camera beats, routes, labels, transitions, and SFX.
- Never hand-write animation seconds.
- Never edit `resolved-episode.json`; edit `episode.json` and rebuild.
- Stop final rendering when alignment mismatch exceeds 10%.

## Use the local commands

Run inside `studio/` with pnpm:

```text
pnpm run doctor
pnpm run episode:new -- --id <slug>
pnpm run assets:matte -- --episode <slug>
pnpm run audio:build -- --episode <slug>
pnpm run timeline:build -- --episode <slug>
pnpm run render:preview -- --episode <slug>
pnpm run qa -- --episode <slug>
pnpm run render:final -- --episode <slug>
pnpm run qa -- --episode <slug>
```

## Protect credentials and users' content

- Keep API keys only in ignored `.env` files or environment variables.
- Never print, copy, commit, or place keys in episode JSON or prompt records.
- Ask the user to follow `docs/CONFIGURATION.md` for paid API setup; do not invent credentials.
- Store each user's content profile locally. Do not substitute a sample profile for their answers.
