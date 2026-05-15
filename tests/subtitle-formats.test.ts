import { test } from "node:test";
import * as assert from "node:assert/strict";

import { parseDoteJson, parseVtt } from "../src/srt";

test("parseVtt parses voice spans as speaker labels", () => {
  const result = parseVtt(`WEBVTT

00:00:44.860 --> 00:00:46.980
<v Оранти>Это просто сводка новостей от Глашатая

00:00:46.980 --> 00:00:47.860
<v GM>на следующий день.
`);

  assert.equal(result.skippedBlocks, 0);
  assert.equal(result.cues.length, 2);
  assert.equal(result.cues[0].startSeconds, 44.86);
  assert.equal(result.cues[0].endSeconds, 46.98);
  assert.equal(result.cues[0].speaker, "Оранти");
  assert.equal(result.cues[0].text, "Это просто сводка новостей от Глашатая");
});

test("parseDoteJson parses lines array into transcript cues", () => {
  const result = parseDoteJson(`{
  "lines": [
    {
      "startTime": "00:00:44,860",
      "endTime": "00:00:46,980",
      "speakerDesignation": "Оранти",
      "text": "Это просто сводка новостей от Глашатая"
    },
    {
      "startTime": "00:00:46,980",
      "endTime": "00:00:47,860",
      "speakerDesignation": "GM",
      "text": "на следующий день."
    }
  ]
}`);

  assert.equal(result.skippedBlocks, 0);
  assert.equal(result.cues.length, 2);
  assert.equal(result.cues[0].index, 1);
  assert.equal(result.cues[0].timestampLabel, "00:00:44,860");
  assert.equal(result.cues[0].speaker, "Оранти");
  assert.equal(result.cues[0].text, "Это просто сводка новостей от Глашатая");
});
