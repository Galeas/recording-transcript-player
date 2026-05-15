export interface AutoOpenRecordingContext {
  enabled: boolean;
  fallbackEnabled: boolean;
  fileExtension: string;
  supportedAudioExtensions: string[];
  hasMatchingSubtitle: boolean;
  currentViewType: string | undefined;
  pluginViewType: string;
  isAutoOpening: boolean;
}

export function shouldAutoOpenRecordingWithTranscript(context: AutoOpenRecordingContext): boolean {
  if (!context.enabled || context.isAutoOpening) {
    return false;
  }

  // No-subtitle files only short-circuit when the fallback is enabled —
  // the fallback path handles them. With the fallback off, route them to
  // the plugin view like any other matched recording.
  if (!context.hasMatchingSubtitle && context.fallbackEnabled) {
    return false;
  }

  if (context.currentViewType === context.pluginViewType) {
    return false;
  }

  return context.supportedAudioExtensions.includes(context.fileExtension.toLowerCase());
}

export interface FallbackToDefaultMediaViewContext {
  parentEnabled: boolean;
  fallbackEnabled: boolean;
  fileExtension: string;
  supportedAudioExtensions: string[];
  hasMatchingSubtitle: boolean;
  currentViewType: string | undefined;
  pluginViewType: string;
  isAutoOpening: boolean;
}

export function shouldFallbackToDefaultMediaView(context: FallbackToDefaultMediaViewContext): boolean {
  if (!context.parentEnabled || !context.fallbackEnabled || context.isAutoOpening) {
    return false;
  }

  if (context.hasMatchingSubtitle) {
    return false;
  }

  if (context.currentViewType !== context.pluginViewType) {
    return false;
  }

  return context.supportedAudioExtensions.includes(context.fileExtension.toLowerCase());
}
