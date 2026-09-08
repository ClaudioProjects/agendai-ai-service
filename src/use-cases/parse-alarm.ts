import type { AlarmParser } from "../contracts/ai";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
export class ParseAlarmUseCase {
  constructor(private readonly parser: AlarmParser) {}
  execute(input: ParseInput): Promise<AlarmDraft[]> {
    return this.parser.parse(input);
  }
}
