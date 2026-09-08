import { createApp } from "./app";
import { loadConfig } from "./config";
import { OpenAIAlarmParser } from "./providers/ai/openai-alarm-parser";
import { OpenAITranscriber } from "./providers/ai/openai-transcriber";
import { FirebaseAppCheckVerifier } from "./providers/auth/firebase-app-check-verifier";
import { UpstashRedisCache } from "./providers/cache/upstash-redis-cache";
import { ParseAlarmUseCase } from "./use-cases/parse-alarm";
import { RegisterAppAuthUseCase } from "./use-cases/register-app-auth";
import { TranscribeAudioUseCase } from "./use-cases/transcribe-audio";

const config = loadConfig();
const cache = new UpstashRedisCache(
  config.REDIS_URL,
  config.REDIS_TOKEN,
  config.UPSTREAM_TIMEOUT_MS,
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
const app = createApp({
  // Keep text and audio on the same parsing use case.
  verifier,
  cache,
  registerAppAuth: new RegisterAppAuthUseCase(
    verifier,
    cache,
    config.FIREBASE_ALLOWED_APP_IDS.split(",")
      .map((appId) => appId.trim())
      .filter(Boolean),
  ),
  parseAlarms: new ParseAlarmUseCase(parser),
  transcribeAudio: new TranscribeAudioUseCase(
    new OpenAITranscriber(
      config.OPENAI_API_KEY,
      config.OPENAI_TRANSCRIPTION_MODEL,
      config.UPSTREAM_TIMEOUT_MS,
    ),
    new ParseAlarmUseCase(parser),
  ),
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
    maxAudioDurationSeconds: config.MAX_AUDIO_DURATION_SECONDS,
    windowSeconds: config.RATE_LIMIT_WINDOW_SECONDS,
    parseIp: config.RATE_LIMIT_PARSE_IP,
    registerIp: config.RATE_LIMIT_REGISTER_IP,
    parseToken: config.RATE_LIMIT_PARSE_TOKEN,
    transcribeIp: config.RATE_LIMIT_TRANSCRIBE_IP,
    transcribeToken: config.RATE_LIMIT_TRANSCRIBE_TOKEN,
  },
});
export default app;
if (import.meta.main)
  Bun.serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
