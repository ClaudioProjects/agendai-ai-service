import type { VerifiedAppIdentity } from "../contracts/auth";
import { ApiError } from "./errors";

export function assertAllowedApp(
  identity: VerifiedAppIdentity,
  allowedAppIds: readonly string[],
): void {
  if (!identity.appId || !allowedAppIds.includes(identity.appId))
    throw new ApiError(
      "APP_CHECK_TOKEN_INVALID",
      401,
      "Firebase App Check token is not authorized for this application.",
    );
}
