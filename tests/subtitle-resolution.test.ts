import { test } from "node:test";
import * as assert from "node:assert/strict";

import { getSubtitleCandidates } from "../src/subtitle-resolution";

test("getSubtitleCandidates resolves sibling files using exact basename and extension priority", () => {
  assert.deepEqual(getSubtitleCandidates("Recordings/2026.05.09.m4a", ["srt", "vtt"]), [
    "Recordings/2026.05.09.srt",
    "Recordings/2026.05.09.vtt"
  ]);
});

test("getSubtitleCandidates handles audio files at the vault root", () => {
  assert.deepEqual(getSubtitleCandidates("Meeting.mp3", ["srt"]), ["Meeting.srt"]);
});
