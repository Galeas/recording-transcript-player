import { test } from "node:test";
import * as assert from "node:assert/strict";

import { shouldRestorePlaybackPosition } from "../src/playback-position";

test("shouldRestorePlaybackPosition restores saved positions away from the end", () => {
  assert.equal(shouldRestorePlaybackPosition(125, 240), true);
});

test("shouldRestorePlaybackPosition does not restore positions in the final ten seconds", () => {
  assert.equal(shouldRestorePlaybackPosition(232, 240), false);
});

test("shouldRestorePlaybackPosition ignores invalid saved positions", () => {
  assert.equal(shouldRestorePlaybackPosition(0, 240), false);
  assert.equal(shouldRestorePlaybackPosition(Number.NaN, 240), false);
  assert.equal(shouldRestorePlaybackPosition(20, Number.NaN), false);
});
