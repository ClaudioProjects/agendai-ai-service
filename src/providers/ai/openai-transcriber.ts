import OpenAI, { APIConnectionError, APIError as OpenAIApiError } from "openai";
import type { AudioInput, AudioTranscriber } from "../../contracts/ai";
import { ApiError } from "../../libs/errors";

export class OpenAITranscriber implements AudioTranscriber {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    timeoutMs: number,
  ) {
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  }

  async transcribe(input: AudioInput): Promise<string> {
    try {
      const file = new File(
        [input.bytes.slice() as unknown as BlobPart],
        input.fileName,
        { type: input.mimeType },
      );
      const response = await this.client.audio.transcriptions.create({
        file,
        model: this.model,
      });
      if (!response.text.trim())
        throw new ApiError(
          "TRANSCRIPTION_FAILED",
          422,
          "Audio contains no transcribable speech.",
        );
      return response.text;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof APIConnectionError ||
        (error instanceof OpenAIApiError && (error.status ?? 0) >= 500)
      ) {
        throw new ApiError(
          "PROVIDER_UNAVAILABLE",
          503,
          "AI provider is unavailable.",
        );
      }
      throw new ApiError(
        "TRANSCRIPTION_FAILED",
        502,
        "Unable to transcribe audio.",
      );
    }
  }
}
