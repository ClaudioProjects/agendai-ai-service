import type { AlarmParser } from "../contracts/ai";
import { fillMissingAlarmDates } from "../libs/alarm-drafts";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
export class ParseAlarmUseCase {
  constructor(private readonly parser: AlarmParser) {}
  async execute(input: ParseInput): Promise<AlarmDraft[]> {
    const drafts = await this.parser.parse(input);
    return fillMissingAlarmDates(drafts, input.context);
  }
}
