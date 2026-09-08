import { ApiError } from "./errors";
export function assertSupportedTimeContext(
  timezone: string,
  locale: string,
): void {
  try {
    Intl.DateTimeFormat("en", { timeZone: timezone });
    Intl.getCanonicalLocales(locale);
  } catch {
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Timezone or locale is not supported.",
    );
  }
}
