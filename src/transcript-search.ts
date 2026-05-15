import type { TranscriptCue } from "./srt";

export type SearchableField = "text" | "speaker";

export interface TranscriptMatch {
  cueIndex: number;
  field: SearchableField;
  start: number;
  end: number;
}

export function findMatches(cues: TranscriptCue[], query: string): TranscriptMatch[] {
  if (query.trim().length === 0 || cues.length === 0) {
    return [];
  }

  const needle = query.toLowerCase();
  const matches: TranscriptMatch[] = [];

  cues.forEach((cue, cueIndex) => {
    if (cue.speaker) {
      collectMatches(cue.speaker, needle, cueIndex, "speaker", matches);
    }
    collectMatches(cue.text, needle, cueIndex, "text", matches);
  });

  return matches;
}

function collectMatches(
  haystack: string,
  needle: string,
  cueIndex: number,
  field: SearchableField,
  out: TranscriptMatch[]
): void {
  const lower = haystack.toLowerCase();
  let from = 0;
  while (from <= lower.length - needle.length) {
    const at = lower.indexOf(needle, from);
    if (at === -1) {
      break;
    }
    out.push({ cueIndex, field, start: at, end: at + needle.length });
    from = at + Math.max(1, needle.length);
  }
}
