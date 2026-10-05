import type { AudioAlarmParser, AudioInput } from "../contracts/ai";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";

export class ParseAudioUseCase {
  constructor(private readonly parser: AudioAlarmParser) {}

  execute(
    audio: AudioInput,
    context: ParseInput["context"],
  ): Promise<AlarmDraft[]> {
    return this.parser.parse({ audio, context });
  }
}
