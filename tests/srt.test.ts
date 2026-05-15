import { test } from "node:test";
import * as assert from "node:assert/strict";

import { countActiveCues, findActiveCue, parseSrt } from "../src/srt";

test("parseSrt parses cue timing, text, and speaker labels", () => {
  const result = parseSrt(`1
00:00:01,250 --> 00:00:04,500
Alice: Welcome to the recording.

2
00:00:05.000 --> 00:00:06.750
This line has no speaker.
`);

  assert.equal(result.skippedBlocks, 0);
  assert.equal(result.cues.length, 2);
  assert.deepEqual(result.cues[0], {
    index: 1,
    startSeconds: 1.25,
    endSeconds: 4.5,
    timestampLabel: "00:00:01,250",
    speaker: "Alice",
    text: "Welcome to the recording."
  });
  assert.equal(result.cues[1].speaker, undefined);
  assert.equal(result.cues[1].text, "This line has no speaker.");
});

test("parseSrt skips malformed blocks and keeps valid cues", () => {
  const result = parseSrt(`1
not a timestamp
Bad block

2
00:00:02,000 --> 00:00:03,000
Valid block
`);

  assert.equal(result.skippedBlocks, 1);
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].index, 2);
  assert.equal(result.cues[0].text, "Valid block");
});

test("parseSrt parses Cyrillic speaker labels", () => {
  const result = parseSrt(`1
00:00:01,000 --> 00:00:02,000
Оранти: Это просто сводка новостей.

2
00:00:03,000 --> 00:00:04,000
Ледобород: Это какая-то немножко клоунская музыка.
`);

  assert.equal(result.skippedBlocks, 0);
  assert.equal(result.cues[0].speaker, "Оранти");
  assert.equal(result.cues[0].text, "Это просто сводка новостей.");
  assert.equal(result.cues[1].speaker, "Ледобород");
  assert.equal(result.cues[1].text, "Это какая-то немножко клоунская музыка.");
});

test("findActiveCue returns the first matching cue for overlaps", () => {
  const result = parseSrt(`1
00:00:01,000 --> 00:00:05,000
First

2
00:00:03,000 --> 00:00:06,000
Second
`);

  assert.equal(findActiveCue(result.cues, 3.5)?.text, "First");
  assert.equal(findActiveCue(result.cues, 6.1), undefined);
});

test("findActiveCue keeps the earliest matching cue when a long cue spans later cues", () => {
  const result = parseSrt(`1
00:00:01,000 --> 00:00:10,000
Long first cue

2
00:00:02,000 --> 00:00:03,000
Short middle cue

3
00:00:04,000 --> 00:00:05,000
Short later cue
`);

  assert.equal(findActiveCue(result.cues, 6)?.text, "Long first cue");
});

test("countActiveCues counts all cues active at a timestamp", () => {
  const result = parseSrt(`1
00:00:01,000 --> 00:00:05,000
First

2
00:00:03,000 --> 00:00:06,000
Second
`);

  assert.equal(countActiveCues(result.cues, 3.5), 2);
  assert.equal(countActiveCues(result.cues, 6.1), 0);
});
