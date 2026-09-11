const capturedAudioMimeAliases: Record<string, string> = {
  // Some Android WebViews label an audio-only MediaRecorder WebM stream as video.
  "video/webm": "audio/webm",
  "video/mp4": "audio/mp4",
};

export function normalizeCapturedAudioMimeType(value: string): string {
  const mimeType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return capturedAudioMimeAliases[mimeType] ?? mimeType;
}
