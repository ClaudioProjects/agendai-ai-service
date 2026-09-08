export type ErrorCode =
  | "APP_CHECK_TOKEN_REQUIRED"
  | "APP_CHECK_TOKEN_INVALID"
  | "AUTH_NOT_REGISTERED"
  | "RATE_LIMIT_EXCEEDED"
  | "VALIDATION_ERROR"
  | "AUDIO_REQUIRED"
  | "AUDIO_TOO_LARGE"
  | "AUDIO_TOO_LONG"
  | "UNSUPPORTED_AUDIO"
  | "TRANSCRIPTION_FAILED"
  | "PARSE_FAILED"
  | "INVALID_AI_RESPONSE"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
  }
}
export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;
