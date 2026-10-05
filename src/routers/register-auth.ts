import { Hono } from "hono";
import type { RegisterAuthController } from "../controllers/register-auth";
import type { CacheStore } from "../contracts/cache";
import { ApiError } from "../libs/errors";
import { rateLimit } from "../middlewares/rate-limit";

export type RegisterAuthRouterDependencies = {
  controller: Pick<RegisterAuthController, "execute">;
  cache: CacheStore;
  limits: {
    registerIp: number;
    windowSeconds: number;
  };
};

export function createRegisterAuthRouter(deps: RegisterAuthRouterDependencies) {
  const router = new Hono();
  router.post(
    "/register-auth",
    rateLimit(deps.cache, {
      route: "register",
      ipLimit: deps.limits.registerIp,
      windowSeconds: deps.limits.windowSeconds,
    }),
    async (context) => {
      const token = context.req.header("X-Firebase-AppCheck");
      if (!token)
        throw new ApiError(
          "APP_CHECK_TOKEN_REQUIRED",
          401,
          "X-Firebase-AppCheck header is required.",
        );

      return context.json(await deps.controller.execute(token));
    },
  );
  return router;
}
