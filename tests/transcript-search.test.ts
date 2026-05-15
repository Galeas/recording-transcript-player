import { test } from "node:test";
import * as assert from "node:assert/strict";

import { findMatches } from "../src/transcript-search";
import type { TranscriptCue } from "../src/srt";

function cue(index: number, text: string, speaker?: string): TranscriptCue {
  return {
    index,
    startSeconds: index,
    endSeconds: index + 1,
    timestampLabel: `${index}`,
    speaker,
    text
  };
}

test("findMatches returns empty array for empty query", () => {
  const cues = [cue(1, "hello world")];
  assert.deepEqual(findMatches(cues, ""), []);
  assert.deepEqual(findMatches(cues, "   "), []);
});

test("findMatches is case-insensitive substring search", () => {
  const cues = [cue(1, "Hello World"), cue(2, "another HELLO here")];
  const matches = findMatches(cues, "hello");

  assert.equal(matches.length, 2);
  assert.deepEqual(matches[0], { cueIndex: 0, field: "text", start: 0, end: 5 });
  assert.deepEqual(matches[1], { cueIndex: 1, field: "text", start: 8, end: 13 });
});

test("findMatches returns multiple positions within the same cue", () => {
  const cues = [cue(1, "foo foo foo")];
  const matches = findMatches(cues, "foo");

  assert.equal(matches.length, 3);
  assert.deepEqual(matches.map((m) => m.start), [0, 4, 8]);
});

test("findMatches searches speaker labels too", () => {
  const cues = [cue(1, "no match here", "Alice"), cue(2, "alice in the text", "Bob")];
  const matches = findMatches(cues, "alice");

  assert.equal(matches.length, 2);
  assert.deepEqual(matches[0], { cueIndex: 0, field: "speaker", start: 0, end: 5 });
  assert.deepEqual(matches[1], { cueIndex: 1, field: "text", start: 0, end: 5 });
});

test("findMatches treats regex metacharacters as literal", () => {
  const cues = [cue(1, "price is $5.00 today"), cue(2, "no dollar here")];
  const matches = findMatches(cues, "$5.00");

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0], { cueIndex: 0, field: "text", start: 9, end: 14 });
});

test("findMatches returns empty when no cues match", () => {
  const cues = [cue(1, "alpha"), cue(2, "beta")];
  assert.deepEqual(findMatches(cues, "gamma"), []);
});

test("findMatches handles empty cue list", () => {
  assert.deepEqual(findMatches([], "anything"), []);
});
