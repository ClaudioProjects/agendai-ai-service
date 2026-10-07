import { Hono } from "hono";
import type { ParseController } from "../controllers/parse";
import type { AppAttestationVerifier } from "../contracts/auth";
import type { CacheStore } from "../contracts/cache";
import { parsePayload } from "../libs/parse-payload";
import { readJsonWithinLimit } from "../libs/request-body";
import { appAuth } from "../middlewares/app-auth";
import { rateLimit } from "../middlewares/rate-limit";

export type ParseRouterDependencies = {
  controller: Pick<ParseController, "execute">;
  verifier: AppAttestationVerifier;
  cache: CacheStore;
  allowedAppIds: readonly string[];
  testAuthToken?: string;
  limits: {
    maxTextLength: number;
    maxJsonBodyBytes: number;
    parseIp: number;
    parseToken: number;
    windowSeconds: number;
  };
};

export function createParseRouter(deps: ParseRouterDependencies) {
  const router = new Hono();
  router.post(
    "/interpret/text",
    appAuth(deps.verifier, deps.cache, deps.allowedAppIds, deps.testAuthToken),
    rateLimit(deps.cache, {
      route: "parse",
      ipLimit: deps.limits.parseIp,
      tokenLimit: deps.limits.parseToken,
      windowSeconds: deps.limits.windowSeconds,
    }),
    async (context) => {
      const body = await readJsonWithinLimit(
        context.req.raw,
        deps.limits.maxJsonBodyBytes,
      );
      const input = parsePayload(body, deps.limits.maxTextLength);
      return context.json(await deps.controller.execute(input));
    },
  );
  return router;
}
