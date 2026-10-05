import OpenAI, { APIConnectionError, APIError as OpenAIApiError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { AlarmParser } from "../../contracts/ai";
import { ApiError } from "../../libs/errors";
import {
  alarmDraftArraySchema,
  alarmDraftResponseSchema,
  type AlarmDraft,
} from "../../schemas/alarm";
import type { ParseInput } from "../../schemas/requests";
import { alarmParsingInstructions } from "./alarm-instructions";

export class OpenAIAlarmParser implements AlarmParser {
  private readonly client: OpenAI;
  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  }
  async parse(input: ParseInput): Promise<AlarmDraft[]> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: alarmParsingInstructions,
        input: JSON.stringify(input),
        text: {
          format: zodTextFormat(alarmDraftResponseSchema, "alarm_drafts"),
        },
      });
      if (response.output_parsed === null)
        throw new ApiError(
          "INVALID_AI_RESPONSE",
          502,
          "AI did not return a structured response.",
        );
      return alarmDraftArraySchema.parse(response.output_parsed.drafts);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === "ZodError")
        throw new ApiError(
          "INVALID_AI_RESPONSE",
          502,
          "AI response does not match the alarm contract.",
        );
      if (
        error instanceof APIConnectionError ||
        (error instanceof OpenAIApiError && (error.status ?? 0) >= 500)
      )
        throw new ApiError(
          "PROVIDER_UNAVAILABLE",
          503,
          "AI provider is unavailable.",
        );
      throw new ApiError("PARSE_FAILED", 502, "Unable to parse alarm request.");
    }
  }
}
