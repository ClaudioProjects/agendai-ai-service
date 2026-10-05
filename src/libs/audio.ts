import { parseBuffer } from "music-metadata";
import { ApiError } from "./errors";

const supportedTypes = new Set(["audio/mpeg", "audio/wav", "audio/x-wav"]);

export async function validateAudio(input: {
  bytes: Uint8Array;
  mimeType: string;
  maxBytes: number;
  maxSeconds: number;
}): Promise<void> {
  if (!supportedTypes.has(input.mimeType))
    throw new ApiError(
      "UNSUPPORTED_AUDIO",
      415,
      "Audio interpretation requires WAV or MP3.",
    );
  if (input.bytes.byteLength > input.maxBytes)
    throw new ApiError(
      "AUDIO_TOO_LARGE",
      413,
      "Audio exceeds the configured size limit.",
    );
  if (!hasExpectedSignature(input.bytes, input.mimeType))
    throw new ApiError(
      "UNSUPPORTED_AUDIO",
      415,
      "Audio content does not match its media type.",
    );
  try {
    const metadata = await parseBuffer(input.bytes, input.mimeType, {
      duration: true,
    });
    const duration = metadata.format.duration;
    if (!Number.isFinite(duration) || duration === undefined)
      throw new ApiError(
        "UNSUPPORTED_AUDIO",
        422,
        "Audio duration cannot be determined.",
      );
    if (duration > input.maxSeconds)
      throw new ApiError(
        "AUDIO_TOO_LONG",
        422,
        "Audio exceeds the configured duration limit.",
      );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("UNSUPPORTED_AUDIO", 422, "Audio is not processable.");
  }
}

function hasExpectedSignature(bytes: Uint8Array, type: string): boolean {
  const text = (start: number, end: number) =>
    new TextDecoder().decode(bytes.slice(start, end));
  if (type === "audio/mpeg")
    return (
      (bytes.length >= 3 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) ||
      text(0, 3) === "ID3"
    );
  if (type === "audio/wav" || type === "audio/x-wav")
    return text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  return false;
}
