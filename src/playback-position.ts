export const FINAL_POSITION_RESTORE_THRESHOLD_SECONDS = 10;

export function shouldRestorePlaybackPosition(savedSeconds: number, durationSeconds: number): boolean {
  if (!Number.isFinite(savedSeconds) || !Number.isFinite(durationSeconds)) {
    return false;
  }

  if (savedSeconds <= 0 || durationSeconds <= 0) {
    return false;
  }

  return durationSeconds - savedSeconds > FINAL_POSITION_RESTORE_THRESHOLD_SECONDS;
}
