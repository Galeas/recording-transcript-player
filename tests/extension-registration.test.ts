import { test } from "node:test";
import * as assert from "node:assert/strict";

import { registerAudioExtensions } from "../src/extension-registration";

test("registerAudioExtensions does not throw when Obsidian rejects an extension registration", () => {
  const errors: unknown[] = [];
  const plugin = {
    registerExtensions() {
      throw new Error("Extension already registered");
    }
  };

  assert.doesNotThrow(() => {
    registerAudioExtensions(plugin, ["mp3"], "recording-transcript-player-view", (error) => {
      errors.push(error);
    });
  });
  assert.equal(errors.length, 1);
});
