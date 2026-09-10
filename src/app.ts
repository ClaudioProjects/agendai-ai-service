import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppAttestationVerifier } from "./contracts/auth";
import type { CacheStore } from "./contracts/cache";
import { ApiError, isApiError } from "./libs/errors";
import { assertSupportedTimeContext } from "./libs/time";
import {
  assertContentLengthWithinLimit,
  readJsonWithinLimit,
} from "./libs/request-body";
import { appAuth } from "./middlewares/app-auth";
import { observability } from "./middlewares/observability";
import { rateLimit } from "./middlewares/rate-limit";
import { parseInputSchema } from "./schemas/requests";
import { validateAudio } from "./libs/audio";
import { ParseAlarmUseCase } from "./use-cases/parse-alarm";
import { RegisterAppAuthUseCase } from "./use-cases/register-app-auth";
import { TranscribeAudioUseCase } from "./use-cases/transcribe-audio";

export type AppDependencies = {
  verifier: AppAttestationVerifier;
  cache: CacheStore;
  registerAppAuth: RegisterAppAuthUseCase;
  testAuthToken?: string;
  parseAlarms: ParseAlarmUseCase;
  transcribeAudio: TranscribeAudioUseCase;
  allowedOrigins: string[];
  allowedAppIds: string[];
  limits: {
    maxTextLength: number;
    maxAudioSizeBytes: number;
    maxJsonBodyBytes: number;
    maxAudioDurationSeconds: number;
    windowSeconds: number;
    parseIp: number;
    registerIp: number;
    parseToken: number;
    transcribeIp: number;
    transcribeToken: number;
  };
};

function parsePayload(value: unknown, maxTextLength: number) {
  const parsed = parseInputSchema.safeParse(value);
  if (!parsed.success)
    throw new ApiError("VALIDATION_ERROR", 400, "Invalid parse payload.");
  if (parsed.data.text.length > maxTextLength)
    throw new ApiError(
      "VALIDATION_ERROR",
      400,
      "Text exceeds the configured character limit.",
    );
  assertSupportedTimeContext(
    parsed.data.context.timezone,
    parsed.data.context.locale,
  );
  return parsed.data;
}

export function createApp(deps: AppDependencies) {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: (origin) =>
        deps.allowedOrigins.includes(origin) ? origin : undefined,
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
  app.post(
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
      if (deps.testAuthToken && token === deps.testAuthToken)
        return context.json({ registered: true });

      await deps.registerAppAuth.execute(token);
      return context.json({ registered: true });
    },
  );
  const protection = (route: "parse" | "transcribe") =>
    [
      appAuth(
        deps.verifier,
        deps.cache,
        deps.allowedAppIds,
        deps.testAuthToken,
      ),
      rateLimit(
        deps.cache,
        route === "parse"
          ? {
              route,
              ipLimit: deps.limits.parseIp,
              tokenLimit: deps.limits.parseToken,
              windowSeconds: deps.limits.windowSeconds,
            }
          : {
              route,
              ipLimit: deps.limits.transcribeIp,
              tokenLimit: deps.limits.transcribeToken,
              windowSeconds: deps.limits.windowSeconds,
            },
      ),
    ] as const;
  app.post("/parse", ...protection("parse"), async (context) => {
    const body = await readJsonWithinLimit(
      context.req.raw,
      deps.limits.maxJsonBodyBytes,
    );
    return context.json(
      await deps.parseAlarms.execute(
        parsePayload(body, deps.limits.maxTextLength),
      ),
    );
  });
  app.post("/transcribe", ...protection("transcribe"), async (context) => {
    assertContentLengthWithinLimit(
      context.req.header("content-length") ?? undefined,
      deps.limits.maxAudioSizeBytes,
      true,
    );
    let form: FormData;
    try {
      form = await context.req.formData();
    } catch {
      throw new ApiError(
        "VALIDATION_ERROR",
        400,
        "Request body must be multipart form-data.",
      );
    }
    const audio = form.get("audio");
    if (!(audio instanceof File))
      throw new ApiError("AUDIO_REQUIRED", 400, "An audio file is required.");
    const contextInput = parsePayload(
      {
        text: "audio",
        context: {
          currentDateTime: form.get("currentDateTime"),
          timezone: form.get("timezone"),
          locale: form.get("locale"),
        },
      },
      deps.limits.maxTextLength,
    ).context;
    const bytes = new Uint8Array(await audio.arrayBuffer());
    await validateAudio({
      bytes,
      mimeType: audio.type,
      maxBytes: deps.limits.maxAudioSizeBytes,
      maxSeconds: deps.limits.maxAudioDurationSeconds,
    });
    return context.json(
      await deps.transcribeAudio.execute(
        { bytes, fileName: audio.name, mimeType: audio.type },
        contextInput,
      ),
    );
  });
  return app;
}
