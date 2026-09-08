import { ApiError } from "./errors";

export function assertContentLengthWithinLimit(
  contentLength: string | undefined,
  maxBytes: number,
  required = false,
): void {
  if (!contentLength) {
    if (required)
      throw new ApiError(
        "VALIDATION_ERROR",
        400,
        "Content-Length header is required.",
      );
    return;
  }
  const size = Number(contentLength);
  if (!Number.isSafeInteger(size) || size < 0)
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Invalid Content-Length header.",
    );
  if (size > maxBytes)
    throw new ApiError(
      "AUDIO_TOO_LARGE",
      413,
      "Request body exceeds the size limit.",
    );
}

export async function readJsonWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  assertContentLengthWithinLimit(
    request.headers.get("content-length") ?? undefined,
    maxBytes,
  );
  if (!request.body)
    throw new ApiError("VALIDATION_ERROR", 400, "Request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(
          "AUDIO_TOO_LARGE",
          413,
          "Request body exceeds the size limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Request body must be valid JSON.",
    );
  }
}
