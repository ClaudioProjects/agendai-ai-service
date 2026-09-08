import type { CacheStore } from "../../contracts/cache";
import { ApiError } from "../../libs/errors";

/** Redis REST adapter. REDIS_URL must be the HTTPS REST endpoint and REDIS_TOKEN its bearer token. */
export class UpstashRedisCache implements CacheStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly timeoutMs: number,
  ) {}

  async get(key: string): Promise<string | null> {
    const result = await this.command(["GET", key]);
    return typeof result === "string" ? result : null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.command(["SET", key, value, "EX", String(ttlSeconds)]);
  }

  async incrementWithinWindow(
    key: string,
    ttlSeconds: number,
  ): Promise<number> {
    const result = await this.command([
      "EVAL",
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      "1",
      key,
      String(ttlSeconds),
    ]);
    if (typeof result !== "number")
      throw new ApiError(
        "PROVIDER_UNAVAILABLE",
        503,
        "Redis returned an invalid rate-limit response.",
      );
    return result;
  }

  private async command(command: string[]): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Redis is unavailable.");
    }
    if (!response.ok)
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Redis is unavailable.");
    const body = (await response.json()) as {
      result?: unknown;
      error?: string;
    };
    if (body.error)
      throw new ApiError("PROVIDER_UNAVAILABLE", 503, "Redis is unavailable.");
    return body.result;
  }
}
