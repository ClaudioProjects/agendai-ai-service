import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";

const baseEnvironment = {
  OPENAI_API_KEY: "test-key",
  OPENAI_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
  OPENAI_PARSE_MODEL: "gpt-4o-mini",
  REDIS_URL: "https://example.com",
  REDIS_TOKEN: "test-token",
  FIREBASE_PROJECT_ID: "firebase-project",
  FIREBASE_CLIENT_EMAIL: "firebase@example.com",
  FIREBASE_PRIVATE_KEY: "firebase-private-key",
  FIREBASE_ALLOWED_APP_IDS: "app-id",
};

describe("environment configuration", () => {
  test("accepts a test token alongside mandatory Firebase configuration", () => {
    const config = loadConfig({
      ...baseEnvironment,
      APP_AUTH_TEST_TOKEN: "local-test-token",
    });
    expect(config.APP_AUTH_TEST_TOKEN).toBe("local-test-token");
    expect(config.FIREBASE_PROJECT_ID).toBe("firebase-project");
  });

  test("requires Firebase configuration even when a test token is configured", () => {
    const { FIREBASE_PROJECT_ID: _, ...withoutFirebaseProject } =
      baseEnvironment;
    expect(() =>
      loadConfig({
        ...withoutFirebaseProject,
        APP_AUTH_TEST_TOKEN: "local-test-token",
      }),
    ).toThrow("Invalid environment configuration");
  });
});
