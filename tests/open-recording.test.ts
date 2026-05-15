import { test } from "node:test";
import * as assert from "node:assert/strict";

import { openRecordingInLeaf } from "../src/open-recording";

test("openRecordingInLeaf explicitly opens the transcript player view for the audio file", async () => {
  const calls: unknown[] = [];
  const leaf = {
    async setViewState(viewState: unknown) {
      calls.push(viewState);
    }
  };

  await openRecordingInLeaf(leaf, { path: "Recordings/2026.05.09.m4a" }, "recording-transcript-player-view");

  assert.deepEqual(calls, [
    {
      type: "recording-transcript-player-view",
      state: { file: "Recordings/2026.05.09.m4a" },
      active: true
    }
  ]);
});
