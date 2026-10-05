import { parseInputSchema } from "../schemas/requests";
import { ApiError } from "./errors";
import { assertSupportedTimeContext } from "./time";

export function parsePayload(value: unknown, maxTextLength: number) {
  const parsed = parseInputSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError("VALIDATION_ERROR", 400, "Invalid parse payload.");
  if (parsed.data.text.length > maxTextLength)
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Text exceeds the configured character limit.",
    );
  assertSupportedTimeContext(
    parsed.data.context.timezone,
    parsed.data.context.locale,
  );
  return parsed.data;
}
