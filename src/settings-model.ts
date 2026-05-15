export interface RecordingTranscriptPlayerSettings {
  subtitleExtensionPriority: string[];
  supportedAudioExtensions: string[];
  autoScroll: boolean;
  resumePlayback: boolean;
  openRecordingsInPluginViewWhenSubtitleExists: boolean;
  fallbackToDefaultMediaViewWhenNoSubtitle: boolean;
  savePositionIntervalSeconds: number;
}

export const DEFAULT_SETTINGS: RecordingTranscriptPlayerSettings = {
  subtitleExtensionPriority: ["srt", "vtt", "json"],
  supportedAudioExtensions: ["m4a", "mp3", "wav", "aac", "flac", "ogg", "opus"],
  autoScroll: true,
  resumePlayback: true,
  openRecordingsInPluginViewWhenSubtitleExists: false,
  fallbackToDefaultMediaViewWhenNoSubtitle: false,
  savePositionIntervalSeconds: 5
};

export interface PlaybackPositionRecord {
  position: number;
  updatedAt: number;
}

export interface RecordingTranscriptPlayerData {
  settings: RecordingTranscriptPlayerSettings;
  playbackPositions: Record<string, PlaybackPositionRecord>;
}

export function normalizeSettings(
  settings: Partial<RecordingTranscriptPlayerSettings> | undefined
): RecordingTranscriptPlayerSettings {
  return {
    subtitleExtensionPriority: normalizeSubtitleExtensions(settings?.subtitleExtensionPriority),
    supportedAudioExtensions: normalizeExtensions(
      settings?.supportedAudioExtensions,
      DEFAULT_SETTINGS.supportedAudioExtensions
    ),
    autoScroll: settings?.autoScroll ?? DEFAULT_SETTINGS.autoScroll,
    resumePlayback: settings?.resumePlayback ?? DEFAULT_SETTINGS.resumePlayback,
    openRecordingsInPluginViewWhenSubtitleExists:
      settings?.openRecordingsInPluginViewWhenSubtitleExists ??
      DEFAULT_SETTINGS.openRecordingsInPluginViewWhenSubtitleExists,
    fallbackToDefaultMediaViewWhenNoSubtitle:
      settings?.fallbackToDefaultMediaViewWhenNoSubtitle ??
      DEFAULT_SETTINGS.fallbackToDefaultMediaViewWhenNoSubtitle,
    savePositionIntervalSeconds: Math.max(
      1,
      Math.floor(settings?.savePositionIntervalSeconds ?? DEFAULT_SETTINGS.savePositionIntervalSeconds)
    )
  };
}

export function parseExtensionList(value: string, fallback: string[]): string[] {
  return normalizeExtensions(value.split(","), fallback);
}

function normalizeSubtitleExtensions(value: string[] | undefined): string[] {
  const normalized = normalizeExtensions(value, DEFAULT_SETTINGS.subtitleExtensionPriority);
  if (normalized.length === 1 && normalized[0] === "srt") {
    return [...DEFAULT_SETTINGS.subtitleExtensionPriority];
  }
  return normalized;
}

function normalizeExtensions(value: string[] | undefined, fallback: string[]): string[] {
  if (!value || value.length === 0) {
    return [...fallback];
  }

  const normalized = value
    .map((extension) => extension.trim().replace(/^\./, "").toLowerCase())
    .filter((extension) => extension.length > 0);

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...fallback];
}
