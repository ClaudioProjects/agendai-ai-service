import type { AppAttestationVerifier } from "../contracts/auth";
import type { CacheStore } from "../contracts/cache";
import { assertAllowedApp } from "../libs/app-id";
import { sha256 } from "../libs/hash";
export class RegisterAppAuthUseCase {
  constructor(
    private readonly verifier: AppAttestationVerifier,
    private readonly cache: CacheStore,
    private readonly allowedAppIds: readonly string[],
  ) {}
  async execute(token: string): Promise<void> {
    const identity = await this.verifier.verify(token);
    assertAllowedApp(identity, this.allowedAppIds);
    const ttl = Math.max(
      1,
      Math.floor(
        ((identity.expiresAt?.getTime() ?? Date.now() + 3600_000) -
          Date.now()) /
          1000,
      ),
    );
    await this.cache.set(`auth:${await sha256(token)}`, "1", ttl);
  }
}
