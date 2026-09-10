import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().min(1).optional(),
);

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TRANSCRIPTION_MODEL: z.string().min(1),
  OPENAI_PARSE_MODEL: z.string().min(1),
  REDIS_URL: z.string().url(),
  REDIS_TOKEN: z.string().min(1),
  APP_AUTH_TEST_TOKEN: optionalNonEmptyString,
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  FIREBASE_ALLOWED_APP_IDS: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z.string().min(1).default("http://localhost:5173"),
  MAX_TEXT_LENGTH: z.coerce.number().int().positive().default(2_000),
  MAX_JSON_BODY_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(10_000)
    .default(10_000),
  // Vercel Functions reject request bodies larger than 4.5 MB. Leave room for multipart overhead.
  MAX_AUDIO_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(4_000_000)
    .default(4_000_000),
  MAX_AUDIO_DURATION_SECONDS: z.coerce.number().positive().default(600),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_REGISTER_IP: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PARSE_IP: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_PARSE_TOKEN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_TRANSCRIBE_IP: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_TRANSCRIBE_TOKEN: z.coerce.number().int().positive().default(10),
  UPSTREAM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(20_000),
});

export type AppConfig = z.infer<typeof envSchema>;
export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): AppConfig {
  const result = envSchema.safeParse(environment);
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  return result.data;
}
