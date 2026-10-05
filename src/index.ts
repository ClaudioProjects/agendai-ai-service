/// <reference types="bun" />

import { Redis } from "@upstash/redis";
import type { Hono } from "hono";
import { ParseController } from "./controllers/parse";
import { RegisterAuthController } from "./controllers/register-auth";
import { TranscribeController } from "./controllers/transcribe";
import { createApp } from "./create-app";
import { loadConfig } from "./config";
import { OpenAIAlarmParser } from "./providers/ai/openai-alarm-parser";
import { OpenAIAudioAlarmParser } from "./providers/ai/openai-audio-alarm-parser";
import { FirebaseAppCheckVerifier } from "./providers/auth/firebase-app-check-verifier";
import { UpstashRedisSdkCache } from "./providers/cache/upstash-redis-sdk-cache";
import { ParseAlarmUseCase } from "./use-cases/parse-alarm";
import { RegisterAppAuthUseCase } from "./use-cases/register-app-auth";
import { ParseAudioUseCase } from "./use-cases/parse-audio";

const config = loadConfig();
const cache = new UpstashRedisSdkCache(
  new Redis({ url: config.REDIS_URL, token: config.REDIS_TOKEN }),
);
const verifier = new FirebaseAppCheckVerifier({
  projectId: config.FIREBASE_PROJECT_ID,
  clientEmail: config.FIREBASE_CLIENT_EMAIL,
  privateKey: config.FIREBASE_PRIVATE_KEY,
});
const parser = new OpenAIAlarmParser(
  config.OPENAI_API_KEY,
  config.OPENAI_PARSE_MODEL,
  config.UPSTREAM_TIMEOUT_MS,
);
const app: Hono = createApp({
  verifier,
  cache,
  controllers: {
    registerAuth: new RegisterAuthController(
      new RegisterAppAuthUseCase(
        verifier,
        cache,
        config.FIREBASE_ALLOWED_APP_IDS.split(",")
          .map((appId) => appId.trim())
          .filter(Boolean),
      ),
      config.APP_AUTH_TEST_TOKEN,
    ),
    parse: new ParseController(new ParseAlarmUseCase(parser)),
    transcribe: new TranscribeController(
      new ParseAudioUseCase(
        new OpenAIAudioAlarmParser(
          config.OPENAI_API_KEY,
          config.OPENAI_AUDIO_MODEL,
          config.UPSTREAM_TIMEOUT_MS,
        ),
      ),
      {
        maxAudioSizeBytes: config.MAX_AUDIO_SIZE_BYTES,
        maxAudioDurationSeconds: config.MAX_AUDIO_DURATION_SECONDS,
      },
    ),
  },
  testAuthToken: config.APP_AUTH_TEST_TOKEN,
  allowedAppIds: config.FIREBASE_ALLOWED_APP_IDS.split(",")
    .map((appId) => appId.trim())
    .filter(Boolean),
  allowedOrigins: config.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  limits: {
    maxTextLength: config.MAX_TEXT_LENGTH,
    maxJsonBodyBytes: config.MAX_JSON_BODY_BYTES,
    maxAudioSizeBytes: config.MAX_AUDIO_SIZE_BYTES,
    windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    parseIp: config.RATE_LIMIT_PARSE_IP,
    registerIp: config.RATE_LIMIT_REGISTER_IP,
    parseToken: config.RATE_LIMIT_PARSE_TOKEN,
    transcribeIp: config.RATE_LIMIT_TRANSCRIBE_IP,
    transcribeToken: config.RATE_LIMIT_TRANSCRIBE_TOKEN,
  },
});

const port = Number(process.env.PORT ?? 3000);

Bun.serve({
  fetch: app.fetch,
  port,
  hostname: "0.0.0.0",
});

console.log(`Server running on port ${port}`);
