import { describe, expect, test } from "bun:test";
import { createApp, type AppDependencies } from "../src/create-app";
import { ParseController } from "../src/controllers/parse";
import { RegisterAuthController } from "../src/controllers/register-auth";
import { TranscribeController } from "../src/controllers/transcribe";
import type {
  AlarmParser,
  AudioParseInput,
  AudioAlarmParser,
} from "../src/contracts/ai";
import type { AppAttestationVerifier } from "../src/contracts/auth";
import type { CacheStore } from "../src/contracts/cache";
import type { AlarmDraft } from "../src/schemas/alarm";
import { ParseAlarmUseCase } from "../src/use-cases/parse-alarm";
import { RegisterAppAuthUseCase } from "../src/use-cases/register-app-auth";
import { ParseAudioUseCase } from "../src/use-cases/parse-audio";
import { ApiError } from "../src/libs/errors";

const draft = (title = "Dentista"): AlarmDraft => ({
  id: null,
  reminderType: "reminder",
  amount: null,
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
  drafts = [draft()];
  async parse(input: { text: string }) {
    this.calls++;
    return input.text === "none" ? [] : this.drafts;
  }
}
class AudioParser implements AudioAlarmParser {
  calls = 0;
  lastInput?: AudioParseInput;
  drafts = [draft()];
  async parse(input: AudioParseInput) {
    this.calls++;
    this.lastInput = input;
    return this.drafts;
  }
}
function fixture(
  overrides: Partial<
    AppDependencies["limits"] & { maxAudioDurationSeconds: number }
  > = {},
  testAuthToken?: string,
) {
  const cache = new MemoryCache();
  const verifier = new Verifier();
  const parser = new Parser();
  const audioParser = new AudioParser();
  const limits = {
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
  };
  const deps: AppDependencies = {
    verifier,
    cache,
    controllers: {
      registerAuth: new RegisterAuthController(
        new RegisterAppAuthUseCase(verifier, cache, ["app"]),
        testAuthToken,
      ),
      parse: new ParseController(new ParseAlarmUseCase(parser)),
      transcribe: new TranscribeController(
        new ParseAudioUseCase(audioParser),
        limits,
      ),
    },
    testAuthToken,
    allowedOrigins: ["http://localhost:5173"],
    allowedAppIds: ["app"],
    limits,
  };
  return { app: createApp(deps), deps, parser, audioParser, verifier };
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

function wav() {
  const bytes = new Uint8Array(364);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    bytes.set(new TextEncoder().encode(text), offset);
  };
  write(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, bytes.length - 44, true);
  return bytes;
}

function audioForm(
  audio = new File([wav()], "request.wav", { type: "audio/wav" }),
) {
  const form = new FormData();
  form.set("audio", audio);
  form.set("currentDateTime", payload.context.currentDateTime);
  form.set("timezone", payload.context.timezone);
  form.set("locale", payload.context.locale);
  return form;
}

const audioHeaders = {
  "X-Firebase-AppCheck": "token",
  "content-length": "900",
};

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
  test("interprets valid audio once with its date context without calling the text parser", async () => {
    const { app, audioParser, parser } = fixture();
    await register(app);
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: audioForm(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([draft()]);
    expect(audioParser.calls).toBe(1);
    expect(parser.calls).toBe(0);
    expect(audioParser.lastInput?.context).toEqual(payload.context);
    expect(audioParser.lastInput?.audio.bytes).toEqual(wav());
    expect(audioParser.lastInput?.audio.mimeType).toBe("audio/x-wav");
  });
  test("returns an empty array for audio with no reminder intent", async () => {
    const { app, audioParser, parser } = fixture();
    audioParser.drafts = [];
    await register(app);
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: audioForm(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(audioParser.calls).toBe(1);
    expect(parser.calls).toBe(0);
  });
  test("rejects an invalid audio body before interpretation", async () => {
    const { app, audioParser } = fixture();
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
    expect(audioParser.calls).toBe(0);
  });
  test("rejects unconverted recorder formats before calling the audio parser", async () => {
    const { app, audioParser } = fixture();
    await register(app);
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: audioForm(
        new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], "request.webm", {
          type: "audio/webm",
        }),
      ),
    });
    expect(response.status).toBe(415);
    expect(audioParser.calls).toBe(0);
  });
  test("requires authentication before audio interpretation", async () => {
    const { app, audioParser } = fixture();
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: audioForm(),
    });
    expect(response.status).toBe(401);
    expect(audioParser.calls).toBe(0);
  });
  test("rejects invalid time context before audio interpretation", async () => {
    const { app, audioParser } = fixture();
    await register(app);
    const form = audioForm();
    form.set("timezone", "Invalid/Timezone");
    const response = await app.request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: form,
    });
    expect(response.status).toBe(400);
    expect(audioParser.calls).toBe(0);
  });
});

describe.each(["/parse", "/transcribe"])(
  "Default alarm dates at %s",
  (route) => {
    test.each([
      ["2026-10-08T01:30:00Z", "America/Sao_Paulo", "2026-10-07"],
      ["2026-10-08T10:30:00+09:00", "America/Sao_Paulo", "2026-10-07"],
      ["2026-10-31T23:30:00Z", "Asia/Tokyo", "2026-11-01"],
      ["2028-03-01T01:30:00Z", "America/Sao_Paulo", "2028-02-29"],
    ])(
      "uses %s in %s for missing dates, producing %s",
      async (currentDateTime, timezone, date) => {
        const { app, parser, audioParser } = fixture();
        const missingDate = { ...draft("Tomar remédio"), date: null };
        const bill: AlarmDraft = {
          ...draft("Pagar conta"),
          reminderType: "pay_bill",
          amount: 150.5,
          date: null,
          time: null,
        };
        const identifiedDate = draft();
        const drafts = [missingDate, bill, identifiedDate];
        parser.drafts = drafts;
        audioParser.drafts = drafts;
        const context = { ...payload.context, currentDateTime, timezone };
        const form = audioForm();
        form.set("currentDateTime", currentDateTime);
        form.set("timezone", timezone);
        await register(app);

        const response = await app.request(route, {
          method: "POST",
          headers: route === "/parse" ? headers : audioHeaders,
          body:
            route === "/parse"
              ? JSON.stringify({ text: "Tomar remédio e pagar conta", context })
              : form,
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
          { ...missingDate, date },
          { ...bill, date },
          identifiedDate,
        ]);
        expect(missingDate.date).toBeNull();
        expect(bill.date).toBeNull();
        expect(parser.calls).toBe(route === "/parse" ? 1 : 0);
        expect(audioParser.calls).toBe(route === "/transcribe" ? 1 : 0);
      },
    );
  },
);

describe("Router/controller boundaries", () => {
  test("register-auth forwards the token and serializes the injected controller result", async () => {
    const { deps, verifier } = fixture();
    let receivedToken: string | undefined;
    const result = { registered: true as const, source: "injected controller" };
    deps.controllers.registerAuth = {
      async execute(token) {
        receivedToken = token;
        return result;
      },
    };
    const response = await createApp(deps).request("/register-auth", {
      method: "POST",
      headers,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(receivedToken).toBe("token");
    expect(verifier.calls).toBe(0);
  });

  test("parse passes plain validated data to its injected controller", async () => {
    const { deps, parser } = fixture({}, "token");
    let receivedInput: unknown;
    const result = [draft("Injected text result")];
    deps.controllers.parse = {
      async execute(input) {
        receivedInput = input;
        return result;
      },
    };
    const response = await createApp(deps).request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, text: `  ${payload.text}  ` }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(receivedInput).toEqual(payload);
    expect(parser.calls).toBe(0);
  });

  test("transcribe converts multipart data to bytes and domain data for its injected controller", async () => {
    const { deps, audioParser } = fixture({}, "token");
    let receivedInput: AudioParseInput | undefined;
    const result = [draft("Injected audio result")];
    deps.controllers.transcribe = {
      async execute(input) {
        receivedInput = input;
        return result;
      },
    };
    const response = await createApp(deps).request("/transcribe", {
      method: "POST",
      headers: audioHeaders,
      body: audioForm(
        new File([wav()], "request.wav", { type: "audio/x-wav" }),
      ),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(receivedInput).toEqual({
      audio: { bytes: wav(), fileName: "request.wav", mimeType: "audio/x-wav" },
      context: payload.context,
    });
    expect(audioParser.calls).toBe(0);
  });

  test.each(["/register-auth", "/parse", "/transcribe"])(
    "rejects a missing App Check header before calling the controller at %s",
    async (route) => {
      const { deps, verifier } = fixture();
      let calls = 0;
      const execute = async (): Promise<never> => {
        calls++;
        throw new Error("Controller must not run");
      };
      deps.controllers = {
        registerAuth: { execute },
        parse: { execute },
        transcribe: { execute },
      };
      const response = await createApp(deps).request(route, {
        method: "POST",
        headers: { "content-length": "900" },
      });

      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe(
        "APP_CHECK_TOKEN_REQUIRED",
      );
      expect(calls).toBe(0);
      expect(verifier.calls).toBe(0);
    },
  );

  test.each(["/register-auth", "/parse", "/transcribe"])(
    "uses the central error handler for controller failures at %s",
    async (route) => {
      const { deps } = fixture({}, "token");
      const execute = async (): Promise<never> => {
        throw new ApiError(
          "PROVIDER_UNAVAILABLE",
          503,
          "Provider unavailable.",
          {
            "Retry-After": "2",
          },
        );
      };
      deps.controllers = {
        registerAuth: { execute },
        parse: { execute },
        transcribe: { execute },
      };
      const response = await createApp(deps).request(route, {
        method: "POST",
        headers: route === "/transcribe" ? audioHeaders : headers,
        body: route === "/transcribe" ? audioForm() : JSON.stringify(payload),
      });

      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("2");
      expect(await response.json()).toEqual({
        error: {
          code: "PROVIDER_UNAVAILABLE",
          message: "Provider unavailable.",
        },
      });
    },
  );

  test("converts unexpected controller failures to the standard internal error response", async () => {
    const { deps } = fixture({}, "token");
    deps.controllers.parse = {
      async execute() {
        throw new Error("Private provider details");
      },
    };
    const response = await createApp(deps).request("/parse", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error." },
    });
  });

  test.each([
    [undefined, 400, "VALIDATION_ERROR"],
    ["invalid", 400, "VALIDATION_ERROR"],
    ["1001", 413, "AUDIO_TOO_LARGE"],
  ] as const)(
    "rejects audio Content-Length %s before invoking the controller",
    async (contentLength, status, code) => {
      const { deps } = fixture({}, "token");
      let calls = 0;
      deps.controllers.transcribe = {
        async execute() {
          calls++;
          return [];
        },
      };
      const requestHeaders: Record<string, string> = {
        "X-Firebase-AppCheck": "token",
      };
      if (contentLength !== undefined)
        requestHeaders["content-length"] = contentLength;
      const response = await createApp(deps).request("/transcribe", {
        method: "POST",
        headers: requestHeaders,
        body: audioForm(),
      });

      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
      expect(calls).toBe(0);
    },
  );

  test.each([
    "{invalid json",
    JSON.stringify({ ...payload, text: "x".repeat(51) }),
  ])(
    "rejects invalid text input before invoking the controller: %s",
    async (body) => {
      const { deps } = fixture({}, "token");
      let calls = 0;
      deps.controllers.parse = {
        async execute() {
          calls++;
          return [];
        },
      };
      const response = await createApp(deps).request("/parse", {
        method: "POST",
        headers,
        body,
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
      expect(calls).toBe(0);
    },
  );
});

describe("Controller failures", () => {
  const failure = new ApiError(
    "PROVIDER_UNAVAILABLE",
    503,
    "Provider unavailable.",
  );
  const failingUseCase = {
    async execute(): Promise<never> {
      throw failure;
    },
  };

  test("registration rejects the use-case error instead of returning success", async () => {
    const controller = new RegisterAuthController(failingUseCase);
    await expect(controller.execute("token")).rejects.toBe(failure);
  });

  test("text parsing propagates the use-case error", async () => {
    const controller = new ParseController(failingUseCase);
    await expect(controller.execute(payload)).rejects.toBe(failure);
  });

  test("audio interpretation propagates the use-case error after validation", async () => {
    const controller = new TranscribeController(failingUseCase, {
      maxAudioSizeBytes: 1000,
      maxAudioDurationSeconds: 1,
    });
    await expect(
      controller.execute({
        audio: { bytes: wav(), fileName: "request.wav", mimeType: "audio/wav" },
        context: payload.context,
      }),
    ).rejects.toBe(failure);
  });
});
