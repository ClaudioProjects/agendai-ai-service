import type { MiddlewareHandler } from "hono";
import type { CacheStore } from "../contracts/cache";
import { ApiError } from "../libs/errors";

export function rateLimit(
  cache: CacheStore,
  input: {
    route: "register" | "parse" | "transcribe";
    ipLimit: number;
    tokenLimit?: number;
    windowSeconds: number;
  },
): MiddlewareHandler {
  return async (context, next) => {
    const window = Math.floor(Date.now() / 1000 / input.windowSeconds);
    const ip =
      context.req.header("x-vercel-forwarded-for")?.trim() || "unknown";
    const ipCount = await cache.incrementWithinWindow(
      `rate:ip:${ip}:${input.route}:${window}`,
      input.windowSeconds,
    );
    if (ipCount > input.ipLimit)
      throw new ApiError("RATE_LIMIT_EXCEEDED", 429, "IP rate limit exceeded.");
    const tokenHash = context.get("tokenHash") as string;
    if (input.tokenLimit === undefined) return next();
    const tokenCount = await cache.incrementWithinWindow(
      `rate:token:${tokenHash}:${input.route}:${window}`,
      input.windowSeconds,
    );
    if (tokenCount > input.tokenLimit)
      throw new ApiError(
        "RATE_LIMIT_EXCEEDED",
        429,
        "Token rate limit exceeded.",
      );
    await next();
  };
}
