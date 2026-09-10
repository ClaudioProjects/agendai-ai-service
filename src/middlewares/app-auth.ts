import type { MiddlewareHandler } from "hono";
import type { AppAttestationVerifier } from "../contracts/auth";
import type { CacheStore } from "../contracts/cache";
import { assertAllowedApp } from "../libs/app-id";
import { ApiError } from "../libs/errors";
import { sha256 } from "../libs/hash";

export function appAuth(
  verifier: AppAttestationVerifier,
  cache: CacheStore,
  allowedAppIds: readonly string[],
  testToken?: string,
): MiddlewareHandler {
  return async (context, next) => {
    const token = context.req.header("X-Firebase-AppCheck");
    if (!token)
      throw new ApiError(
        "APP_CHECK_TOKEN_REQUIRED",
        401,
        "X-Firebase-AppCheck header is required.",
      );
    const tokenHash = await sha256(token);
    if (testToken && token === testToken) {
      context.set("tokenHash", tokenHash);
      return next();
    }
    assertAllowedApp(await verifier.verify(token), allowedAppIds);
    if ((await cache.get(`auth:${tokenHash}`)) === null)
      throw new ApiError(
        "AUTH_NOT_REGISTERED",
        401,
        "Firebase App Check token is not registered.",
      );
    context.set("tokenHash", tokenHash);
    await next();
  };
}
