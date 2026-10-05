import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ParseController } from "./controllers/parse";
import type { RegisterAuthController } from "./controllers/register-auth";
import type { TranscribeController } from "./controllers/transcribe";
import type { AppAttestationVerifier } from "./contracts/auth";
import type { CacheStore } from "./contracts/cache";
import { ApiError, isApiError } from "./libs/errors";
import { observability } from "./middlewares/observability";
import { createParseRouter } from "./routers/parse";
import { createRegisterAuthRouter } from "./routers/register-auth";
import { createTranscribeRouter } from "./routers/transcribe";

export type AppDependencies = {
  verifier: AppAttestationVerifier;
  cache: CacheStore;
  controllers: {
    registerAuth: Pick<RegisterAuthController, "execute">;
    parse: Pick<ParseController, "execute">;
    transcribe: Pick<TranscribeController, "execute">;
  };
  testAuthToken?: string;
  allowedOrigins: string[];
  allowedAppIds: string[];
  limits: {
    maxTextLength: number;
    maxAudioSizeBytes: number;
    maxJsonBodyBytes: number;
    windowSeconds: number;
    parseIp: number;
    registerIp: number;
    parseToken: number;
    transcribeIp: number;
    transcribeToken: number;
  };
};

export function createApp(deps: AppDependencies) {
  const app = new Hono();
  app.use(
    "*",
    cors({
      allowMethods: ["POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Firebase-AppCheck"],
    }),
  );
  app.use("*", observability);
  app.onError((error, context) => {
    const known = isApiError(error)
      ? error
      : new ApiError("INTERNAL_ERROR", 500, "Internal server error.");
    return context.json(
      { error: { code: known.code, message: known.message } },
      known.status as 400,
      known.headers,
    );
  });
  const routerDependencies = {
    verifier: deps.verifier,
    cache: deps.cache,
    allowedAppIds: deps.allowedAppIds,
    testAuthToken: deps.testAuthToken,
    limits: deps.limits,
  };
  app.route(
    "/",
    createRegisterAuthRouter({
      cache: deps.cache,
      limits: deps.limits,
      controller: deps.controllers.registerAuth,
    }),
  );
  app.route(
    "/",
    createParseRouter({
      ...routerDependencies,
      controller: deps.controllers.parse,
    }),
  );
  app.route(
    "/",
    createTranscribeRouter({
      ...routerDependencies,
      controller: deps.controllers.transcribe,
    }),
  );
  return app;
}
