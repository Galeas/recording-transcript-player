export interface TranscriptCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  timestampLabel: string;
  speaker?: string;
  text: string;
}

export interface ParseSrtResult {
  cues: TranscriptCue[];
  skippedBlocks: number;
}

const TIMING_PATTERN =
  /^(\d{2}:\d{2}:\d{2}[,.]\d{1,3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{1,3})/;
const VTT_TIMING_PATTERN =
  /^((?:\d{2}:)?\d{2}:\d{2}\.\d{1,3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{1,3})/;
const VTT_VOICE_PATTERN = /^<v\s+([^>]+)>(.*)$/u;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const SPEAKER_PATTERN = /^([\p{L}\p{N}][\p{L}\p{N} ._'’-]{0,48}):\s*(.*)$/u;

export function parseSrt(source: string): ParseSrtResult {
  const blocks = source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0);

  const cues: TranscriptCue[] = [];
  let skippedBlocks = 0;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed = parseBlock(lines);
    if (parsed) {
      cues.push(parsed);
    } else {
      skippedBlocks++;
    }
  }

  cues.sort((a, b) => a.startSeconds - b.startSeconds || a.index - b.index);
  return { cues, skippedBlocks };
}

export function parseVtt(source: string): ParseSrtResult {
  const blocks = normalizeLineEndings(source)
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0);

  const cues: TranscriptCue[] = [];
  let skippedBlocks = 0;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines[0] === "WEBVTT" || lines[0]?.startsWith("NOTE") || lines[0]?.startsWith("STYLE")) {
      continue;
    }

    const parsed = parseVttBlock(lines, cues.length + 1);
    if (parsed) {
      cues.push(parsed);
    } else {
      skippedBlocks++;
    }
  }

  cues.sort((a, b) => a.startSeconds - b.startSeconds || a.index - b.index);
  return { cues, skippedBlocks };
}

export function parseDoteJson(source: string): ParseSrtResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return { cues: [], skippedBlocks: 1 };
  }

  if (!isDoteTranscript(parsed)) {
    return { cues: [], skippedBlocks: 1 };
  }

  const cues: TranscriptCue[] = [];
  let skippedBlocks = 0;

  parsed.lines.forEach((line, sourceIndex) => {
    const startSeconds = timestampToSeconds(line.startTime);
    const endSeconds = timestampToSeconds(line.endTime);
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      endSeconds < startSeconds ||
      line.text.trim().length === 0
    ) {
      skippedBlocks++;
      return;
    }

    cues.push({
      index: sourceIndex + 1,
      startSeconds,
      endSeconds,
      timestampLabel: line.startTime,
      speaker: line.speakerDesignation.trim() || undefined,
      text: line.text.trim()
    });
  });

  cues.sort((a, b) => a.startSeconds - b.startSeconds || a.index - b.index);
  return { cues, skippedBlocks };
}

export function parseSubtitleSource(source: string, extension: string): ParseSrtResult {
  switch (extension.trim().replace(/^\./, "").toLowerCase()) {
    case "vtt":
      return parseVtt(source);
    case "json":
      return parseDoteJson(source);
    case "srt":
    default:
      return parseSrt(source);
  }
}

export function findActiveCue(cues: TranscriptCue[], seconds: number): TranscriptCue | undefined {
  if (!Number.isFinite(seconds) || cues.length === 0) {
    return undefined;
  }

  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cues[mid].startSeconds <= seconds) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (candidate === -1) {
    return undefined;
  }

  for (let i = 0; i <= candidate; i++) {
    if (seconds >= cues[i].startSeconds && seconds <= cues[i].endSeconds) {
      return cues[i];
    }
  }

  return undefined;
}

export function countActiveCues(cues: TranscriptCue[], seconds: number): number {
  if (!Number.isFinite(seconds) || cues.length === 0) {
    return 0;
  }

  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cues[mid].startSeconds <= seconds) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (candidate === -1) {
    return 0;
  }

  let count = 0;
  for (let i = 0; i <= candidate; i++) {
    if (seconds >= cues[i].startSeconds && seconds <= cues[i].endSeconds) {
      count++;
    }
  }
  return count;
}

function parseBlock(lines: string[]): TranscriptCue | undefined {
  if (lines.length < 2) {
    return undefined;
  }

  const index = Number.parseInt(lines[0], 10);
  const timingLineIndex = Number.isFinite(index) ? 1 : 0;
  const timingMatch = lines[timingLineIndex]?.match(TIMING_PATTERN);
  const textLines = lines.slice(timingLineIndex + 1);

  if (!timingMatch || textLines.length === 0) {
    return undefined;
  }

  const startSeconds = timestampToSeconds(timingMatch[1]);
  const endSeconds = timestampToSeconds(timingMatch[2]);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds < startSeconds) {
    return undefined;
  }

  const speakerMatch = textLines[0].match(SPEAKER_PATTERN);
  const rawText = textLines.join("\n");
  const text = speakerMatch ? [speakerMatch[2], ...textLines.slice(1)].join("\n").trim() : rawText;

  return {
    index: Number.isFinite(index) ? index : 0,
    startSeconds,
    endSeconds,
    timestampLabel: timingMatch[1],
    speaker: speakerMatch?.[1],
    text
  };
}

function parseVttBlock(lines: string[], index: number): TranscriptCue | undefined {
  const timingLineIndex = VTT_TIMING_PATTERN.test(lines[0]) ? 0 : 1;
  const timingMatch = lines[timingLineIndex]?.match(VTT_TIMING_PATTERN);
  const textLines = lines.slice(timingLineIndex + 1);
  if (!timingMatch || textLines.length === 0) {
    return undefined;
  }

  const startSeconds = timestampToSeconds(timingMatch[1]);
  const endSeconds = timestampToSeconds(timingMatch[2]);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds < startSeconds) {
    return undefined;
  }

  const firstTextLine = textLines[0];
  const voiceMatch = firstTextLine.match(VTT_VOICE_PATTERN);
  const normalizedTextLines = voiceMatch ? [voiceMatch[2], ...textLines.slice(1)] : textLines;

  return {
    index,
    startSeconds,
    endSeconds,
    timestampLabel: timingMatch[1],
    speaker: voiceMatch?.[1].trim(),
    text: normalizedTextLines.join("\n").replace(HTML_TAG_PATTERN, "").trim()
  };
}

function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.replace(",", ".").split(":");
  const [hours, minutes, secondsWithMillis] = parts.length === 3 ? parts : ["0", parts[0], parts[1]];
  const [seconds, millis = "0"] = secondsWithMillis.split(".");

  return (
    Number.parseInt(hours, 10) * 3600 +
    Number.parseInt(minutes, 10) * 60 +
    Number.parseInt(seconds, 10) +
    Number.parseInt(millis.padEnd(3, "0").slice(0, 3), 10) / 1000
  );
}

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

interface DoteTranscript {
  lines: DoteTranscriptLine[];
}

interface DoteTranscriptLine {
  startTime: string;
  endTime: string;
  speakerDesignation: string;
  text: string;
}

function isDoteTranscript(value: unknown): value is DoteTranscript {
  if (!value || typeof value !== "object" || !Array.isArray((value as DoteTranscript).lines)) {
    return false;
  }

  return (value as DoteTranscript).lines.every(
    (line) =>
      line &&
      typeof line === "object" &&
      typeof line.startTime === "string" &&
      typeof line.endTime === "string" &&
      typeof line.speakerDesignation === "string" &&
      typeof line.text === "string"
  );
}
