# Recording Transcript Player

Recording Transcript Player is an Obsidian plugin for opening audio files with a synchronized sibling SRT transcript.

<img width="800" height="610" alt="recording-transcript-player-screenshot" src="https://github.com/user-attachments/assets/4e7e9bd0-10d0-4796-890b-9a75d2485f1d" />

## Usage

Place an `.srt`, `.vtt`, or DOTe `.json` file beside an audio file with the exact same basename:

```text
Recordings/2026.05.09.m4a
Recordings/2026.05.09.srt
```

Open the audio file in Obsidian. The plugin shows the native audio player above the transcript, highlights the active subtitle during playback, and lets you click timestamps to seek.

Supported subtitle formats:

- SRT blocks with optional `Speaker: text`
- WebVTT cues with optional `<v Speaker>` voice spans
- DOTe JSON exports with a `lines` array containing `startTime`, `endTime`, `speakerDesignation`, and `text`

Supported audio extensions by default:

```text
m4a, mp3, wav, aac, flac, ogg, opus
```

## Matching Rules

The plugin only checks sibling subtitle files with the same basename as the audio file. By default it checks `.srt`, `.vtt`, then `.json`; the extension priority can be changed in settings.

If no matching subtitle file is found, the audio player still opens and the transcript area shows an audio-only state.

## Settings

- Subtitle extension priority
- Supported audio extensions
- Auto-scroll transcript
- Resume playback
- Open matched recordings in the plugin view
- Fall back to default media view when no subtitle (sub-option)
- Save position interval

Playback progress is saved per vault-relative audio path. Saved positions in the final 10 seconds of a recording are not restored.

The automatic plugin-view option is disabled by default. When enabled, opening a supported audio file normally in Obsidian will switch that active tab to the transcript player only if a matching sibling subtitle file exists.

The sub-option "Fall back to default media view when no subtitle" (also disabled by default, and only effective when the parent option is enabled) controls what happens when a supported audio file is loaded into the plugin view but has no matching subtitle. When enabled, the file is moved to Obsidian's default media view instead.

## Privacy

This plugin does not make network requests, send telemetry, or use Node/Electron-only runtime APIs. Audio and subtitle files are read through Obsidian vault APIs.

## Mobile Support

The plugin is intended to work on Obsidian desktop and mobile. It uses browser audio APIs and Obsidian-safe vault APIs only.

## Dependency Policy

Runtime dependencies are intentionally zero. Development dependencies are limited to TypeScript, esbuild, Obsidian types, and test/build tooling.

## Development

```bash
npm install
npm test
npm run build
```

The build emits `main.js` at the repository root. Obsidian loads `main.js`, `manifest.json`, and `styles.css`.

## Release

Tagged releases should attach:

- `main.js`
- `manifest.json`
- `styles.css`

Before submitting to the Obsidian community plugin registry, test the release assets in a clean vault and confirm the version tag matches `manifest.json`.
