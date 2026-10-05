import type { AudioParseInput } from "../contracts/ai";
import { validateAudio } from "../libs/audio";
import { normalizeCapturedAudioMimeType } from "../libs/audio-mime";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseAudioUseCase } from "../use-cases/parse-audio";

export class TranscribeController {
  constructor(
    private readonly parseAudio: Pick<ParseAudioUseCase, "execute">,
    private readonly limits: {
      maxAudioSizeBytes: number;
      maxAudioDurationSeconds: number;
    },
  ) {}

  async execute(input: AudioParseInput): Promise<AlarmDraft[]> {
    const audio = {
      ...input.audio,
      mimeType: normalizeCapturedAudioMimeType(input.audio.mimeType),
    };
    await validateAudio({
      bytes: audio.bytes,
      mimeType: audio.mimeType,
      maxBytes: this.limits.maxAudioSizeBytes,
      maxSeconds: this.limits.maxAudioDurationSeconds,
    });

    return this.parseAudio.execute(audio, input.context);
  }
}
