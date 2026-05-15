export function getSubtitleCandidates(audioPath: string, extensions: string[]): string[] {
  const normalizedExtensions = extensions
    .map((extension) => extension.trim().replace(/^\./, "").toLowerCase())
    .filter((extension) => extension.length > 0);

  const lastSlash = audioPath.lastIndexOf("/");
  const directory = lastSlash === -1 ? "" : audioPath.slice(0, lastSlash + 1);
  const filename = lastSlash === -1 ? audioPath : audioPath.slice(lastSlash + 1);
  const lastDot = filename.lastIndexOf(".");
  const basename = lastDot === -1 ? filename : filename.slice(0, lastDot);

  return normalizedExtensions.map((extension) => `${directory}${basename}.${extension}`);
}
