export interface ExtensionRegistrar {
  registerExtensions(extensions: string[], viewType: string): void;
}

export function registerAudioExtensions(
  plugin: ExtensionRegistrar,
  extensions: string[],
  viewType: string,
  onError: (error: unknown) => void = console.warn
): void {
  try {
    plugin.registerExtensions(extensions, viewType);
  } catch (error) {
    onError(error);
  }
}
