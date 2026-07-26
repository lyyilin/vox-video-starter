# Environment contract

Read `docs/INSTALL.md` and `docs/CONFIGURATION.md` from the repository root.

Required runtime tools:

- Node.js 20 or newer
- pnpm 9 or newer
- Python 3.10 for the pinned rembg environment
- FFmpeg and FFprobe on `PATH`
- Git for cloning and updates

Recommended agent capabilities:

- Built-in Imagegen
- Worker/subagent tasks for one-asset-per-worker generation
- The Remotion best-practices plugin/skill when editing Remotion code

Run the platform setup script, then `cd studio` and `pnpm run doctor`. Never read or print the value of `.env`. Report only whether a required variable is configured.

First use downloads npm packages, a Whisper model, a rembg model, and the licensed default BGM. Warn users that this requires network access and several gigabytes of free disk space.
