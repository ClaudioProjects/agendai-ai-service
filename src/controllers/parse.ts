import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
import type { ParseAlarmUseCase } from "../use-cases/parse-alarm";

export class ParseController {
  constructor(
    private readonly parseAlarms: Pick<ParseAlarmUseCase, "execute">,
  ) {}

  execute(input: ParseInput): Promise<AlarmDraft[]> {
    return this.parseAlarms.execute(input);
  }
}
