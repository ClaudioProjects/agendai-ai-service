import { Hono } from "hono";
import type { TranscribeController } from "../controllers/transcribe";
import type { AppAttestationVerifier } from "../contracts/auth";
import type { CacheStore } from "../contracts/cache";
import { ApiError } from "../libs/errors";
import { parsePayload } from "../libs/parse-payload";
import { assertContentLengthWithinLimit } from "../libs/request-body";
import { appAuth } from "../middlewares/app-auth";
import { rateLimit } from "../middlewares/rate-limit";

export type TranscribeRouterDependencies = {
  controller: Pick<TranscribeController, "execute">;
  verifier: AppAttestationVerifier;
  cache: CacheStore;
  allowedAppIds: readonly string[];
  testAuthToken?: string;
  limits: {
    maxTextLength: number;
    maxAudioSizeBytes: number;
    transcribeIp: number;
    transcribeToken: number;
    windowSeconds: number;
  };
};

export function createTranscribeRouter(deps: TranscribeRouterDependencies) {
  const router = new Hono();
  router.post(
    "/interpret/audio",
    appAuth(deps.verifier, deps.cache, deps.allowedAppIds, deps.testAuthToken),
    rateLimit(deps.cache, {
      route: "transcribe",
      ipLimit: deps.limits.transcribeIp,
      tokenLimit: deps.limits.transcribeToken,
      windowSeconds: deps.limits.windowSeconds,
    }),
    async (context) => {
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
      const input = {
        audio: {
          bytes: new Uint8Array(await audio.arrayBuffer()),
          fileName: audio.name,
          mimeType: audio.type,
        },
        context: contextInput,
      };

      return context.json(await deps.controller.execute(input));
    },
  );
  return router;
}
