import { test } from "node:test";
import * as assert from "node:assert/strict";

import { shouldAutoOpenRecordingWithTranscript, shouldFallbackToDefaultMediaView } from "../src/auto-open";

test("shouldAutoOpenRecordingWithTranscript opens when subtitle exists and parent enabled", () => {
  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: true,
      fallbackEnabled: true,
      fileExtension: "m4a",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: true,
      currentViewType: "audio",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    true
  );

  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: false,
      fallbackEnabled: true,
      fileExtension: "m4a",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: true,
      currentViewType: "audio",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    false
  );

  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: true,
      fallbackEnabled: true,
      fileExtension: "m4a",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: false,
      currentViewType: "audio",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    false
  );
});

test("shouldAutoOpenRecordingWithTranscript opens no-subtitle files when fallback is disabled", () => {
  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: true,
      fallbackEnabled: false,
      fileExtension: "m4a",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: false,
      currentViewType: "audio",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    true
  );
});

test("shouldFallbackToDefaultMediaView fires when in plugin view without subtitle and both options enabled", () => {
  const base = {
    parentEnabled: true,
    fallbackEnabled: true,
    fileExtension: "m4a",
    supportedAudioExtensions: ["m4a"],
    hasMatchingSubtitle: false,
    currentViewType: "recording-transcript-player-view",
    pluginViewType: "recording-transcript-player-view",
    isAutoOpening: false
  };

  assert.equal(shouldFallbackToDefaultMediaView(base), true);

  assert.equal(shouldFallbackToDefaultMediaView({ ...base, parentEnabled: false }), false);
  assert.equal(shouldFallbackToDefaultMediaView({ ...base, fallbackEnabled: false }), false);
  assert.equal(shouldFallbackToDefaultMediaView({ ...base, hasMatchingSubtitle: true }), false);
  assert.equal(shouldFallbackToDefaultMediaView({ ...base, currentViewType: "audio" }), false);
  assert.equal(shouldFallbackToDefaultMediaView({ ...base, fileExtension: "md" }), false);
  assert.equal(shouldFallbackToDefaultMediaView({ ...base, isAutoOpening: true }), false);
});

test("shouldAutoOpenRecordingWithTranscript avoids loops and unsupported files", () => {
  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: true,
      fallbackEnabled: true,
      fileExtension: "m4a",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: true,
      currentViewType: "recording-transcript-player-view",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    false
  );

  assert.equal(
    shouldAutoOpenRecordingWithTranscript({
      enabled: true,
      fallbackEnabled: true,
      fileExtension: "md",
      supportedAudioExtensions: ["m4a"],
      hasMatchingSubtitle: true,
      currentViewType: "markdown",
      pluginViewType: "recording-transcript-player-view",
      isAutoOpening: false
    }),
    false
  );
});
