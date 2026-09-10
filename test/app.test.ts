import { describe, expect, test } from "bun:test";
import { createApp, type AppDependencies } from "../src/app";
import type {
  AlarmParser,
  AudioInput,
  AudioTranscriber,
} from "../src/contracts/ai";
import type { AppAttestationVerifier } from "../src/contracts/auth";
import type { CacheStore } from "../src/contracts/cache";
import type { AlarmDraft } from "../src/schemas/alarm";
import { ParseAlarmUseCase } from "../src/use-cases/parse-alarm";
import { RegisterAppAuthUseCase } from "../src/use-cases/register-app-auth";
import { TranscribeAudioUseCase } from "../src/use-cases/transcribe-audio";
import { ApiError } from "../src/libs/errors";

const draft = (title = "Dentista"): AlarmDraft => ({
  id: null,
  eventType: "DENTIST",
  date: "2026-09-09",
  time: "14:00",
  recurrence: null,
  notifications: null,
  status: null,
  createdAt: null,
  updatedAt: null,
  exceptions: null,
  title,
  description: null,
  eventColor: null,
});
class MemoryCache implements CacheStore {
  values = new Map<string, string>();
  counts = new Map<string, number>();
  async get(key: string) {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.values.set(key, value);
  }
  async incrementWithinWindow(key: string) {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}
class Verifier implements AppAttestationVerifier {
  calls = 0;
  async verify(token: string) {
    this.calls++;
    if (token === "bad")
      throw new ApiError("APP_CHECK_TOKEN_INVALID", 401, "bad");
    return { appId: "app", expiresAt: new Date(Date.now() + 60_000) };
  }
}
class Parser implements AlarmParser {
  calls = 0;
  async parse(input: { text: string }) {
    this.calls++;
    return input.text === "none" ? [] : [draft()];
  }
}
class Transcriber implements AudioTranscriber {
  calls = 0;
  async transcribe(_input: AudioInput) {
    this.calls++;
    return "dentista amanhã às duas";
  }
}
function fixture(
  overrides: Partial<AppDependencies["limits"]> = {},
  testAuthToken?: string,
) {
  const cache = new MemoryCache();
  const verifier = new Verifier();
  const parser = new Parser();
  const transcriber = new Transcriber();
  const deps: AppDependencies = {
    verifier,
    cache,
    registerAppAuth: new RegisterAppAuthUseCase(verifier, cache, ["app"]),
    testAuthToken,
    parseAlarms: new ParseAlarmUseCase(parser),
    transcribeAudio: new TranscribeAudioUseCase(
      transcriber,
      new ParseAlarmUseCase(parser),
    ),
    allowedOrigins: ["http://localhost:5173"],
    allowedAppIds: ["app"],
    limits: {
      maxTextLength: 50,
      maxJsonBodyBytes: 10_000,
      maxAudioSizeBytes: 1000,
      maxAudioDurationSeconds: 1,
      windowSeconds: 60,
      parseIp: 10,
      registerIp: 10,
      parseToken: 10,
      transcribeIp: 10,
      transcribeToken: 10,
      ...overrides,
    },
  };
  return { app: createApp(deps), parser, transcriber, verifier };
}
const headers = {
  "X-Firebase-AppCheck": "token",
  "Content-Type": "application/json",
  "x-vercel-forwarded-for": "127.0.0.1",
};
const payload = {
  text: "dentista amanhã às duas",
  context: {
    currentDateTime: "2026-09-08T10:00:00-03:00",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
  },
};
async function register(app: ReturnType<typeof createApp>) {
  await app.request("/register-auth", { method: "POST", headers });
}

describe("AgendAI API", () => {
  test("registers a valid App Check token without storing it raw", async () => {
    const { app } = fixture();
    const response = await app.request("/register-auth", {
      method: "POST",
      headers,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });
  });
  test("requires a registered valid token before parsing", async () => {
    const { app, parser } = fixture();
    const response = await app.request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(401);
    expect(parser.calls).toBe(0);
  });
  test("registers the configured test token without calling Firebase", async () => {
    const { app, verifier } = fixture({}, "local-test-token");
    const response = await app.request("/register-auth", {
      method: "POST",
      headers: { ...headers, "X-Firebase-AppCheck": "local-test-token" },
    });
    expect(response.status).toBe(200);
    expect(verifier.calls).toBe(0);
  });
  test("accepts the configured test token without Firebase verification or registration", async () => {
    const { app, parser, verifier } = fixture({}, "local-test-token");
    const response = await app.request("/parse", {
      method: "POST",
      headers: { ...headers, "X-Firebase-AppCheck": "local-test-token" },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(200);
    expect(parser.calls).toBe(1);
    expect(verifier.calls).toBe(0);
  });
  test("returns an AlarmDraft array and accepts no reminder intent", async () => {
    const { app } = fixture();
    await register(app);
    const response = await app.request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([draft()]);
    const none = await app.request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, text: "none" }),
    });
    expect(await none.json()).toEqual([]);
  });
  test("does not call parser for invalid payload", async () => {
    const { app, parser } = fixture();
    await register(app);
    const response = await app.request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, text: "" }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(parser.calls).toBe(0);
  });
  test("limits by token after registration", async () => {
    const { app } = fixture({ parseToken: 1 });
    await register(app);
    expect(
      (
        await app.request("/parse", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        })
      ).status,
    ).toBe(200);
    const response = await app.request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
  test("rejects an invalid audio body before transcription", async () => {
    const { app, transcriber } = fixture();
    await register(app);
    const form = new FormData();
    form.set(
      "audio",
      new File([new Uint8Array([1, 2])], "bad.wav", { type: "audio/wav" }),
    );
    form.set("currentDateTime", payload.context.currentDateTime);
    form.set("timezone", payload.context.timezone);
    form.set("locale", payload.context.locale);
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: { "X-Firebase-AppCheck": "token", "content-length": "100" },
      body: form,
    });
    expect(response.status).toBe(415);
    expect(transcriber.calls).toBe(0);
  });
});
