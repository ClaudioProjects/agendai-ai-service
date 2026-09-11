import { describe, expect, test } from "bun:test";
import { zodTextFormat } from "openai/helpers/zod";
import { alarmDraftResponseSchema } from "../src/schemas/alarm";

describe("OpenAI alarm response schema", () => {
  test("is compatible with strict Structured Outputs", () => {
    expect(() =>
      zodTextFormat(alarmDraftResponseSchema, "alarm_drafts"),
    ).not.toThrow();
  });
});
