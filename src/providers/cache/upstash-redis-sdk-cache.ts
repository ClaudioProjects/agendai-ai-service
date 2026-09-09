import { Redis } from "@upstash/redis";
import type { CacheStore } from "../../contracts/cache";
import { ApiError } from "../../libs/errors";

type UpstashRedisClient = Pick<Redis, "get" | "set" | "eval">;

/** Cache adapter backed by the official @upstash/redis client. */
export class UpstashRedisSdkCache implements CacheStore {
  constructor(private readonly redis: UpstashRedisClient) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get<string>(key);
    } catch {
      throw this.unavailable();
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, value, { ex: ttlSeconds });
    } catch {
      throw this.unavailable();
    }
  }

  async incrementWithinWindow(
    key: string,
    ttlSeconds: number,
  ): Promise<number> {
    try {
      const count = await this.redis.eval<[string], number>(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        [key],
        [String(ttlSeconds)],
      );
      if (!Number.isInteger(count)) throw new Error("Invalid Redis response");
      return count;
    } catch {
      throw this.unavailable();
    }
  }

  private unavailable(): ApiError {
    return new ApiError("PROVIDER_UNAVAILABLE", 503, "Redis is unavailable.");
  }
}
