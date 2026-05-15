import { test } from "node:test";
import * as assert from "node:assert/strict";

import { normalizeSettings } from "../src/settings-model";

test("normalizeSettings migrates the legacy subtitle extension default", () => {
  const settings = normalizeSettings({ subtitleExtensionPriority: ["srt"] });

  assert.deepEqual(settings.subtitleExtensionPriority, ["srt", "vtt", "json"]);
});

test("normalizeSettings keeps automatic plugin-view opening disabled by default", () => {
  const settings = normalizeSettings(undefined);

  assert.equal(settings.openRecordingsInPluginViewWhenSubtitleExists, false);
});
