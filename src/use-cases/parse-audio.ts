import type { AudioAlarmParser, AudioInput } from "../contracts/ai";
import { fillMissingAlarmDates } from "../libs/alarm-drafts";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";

export class ParseAudioUseCase {
  constructor(private readonly parser: AudioAlarmParser) {}

  async execute(
    audio: AudioInput,
    context: ParseInput["context"],
  ): Promise<AlarmDraft[]> {
    const drafts = await this.parser.parse({ audio, context });
    return fillMissingAlarmDates(drafts, context);
  }
}
