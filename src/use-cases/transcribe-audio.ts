import type { AudioInput, AudioTranscriber } from "../contracts/ai";
import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
import { ParseAlarmUseCase } from "./parse-alarm";
export class TranscribeAudioUseCase {
  constructor(
    private readonly transcriber: AudioTranscriber,
    private readonly parseAlarms: ParseAlarmUseCase,
  ) {}
  async execute(
    audio: AudioInput,
    context: ParseInput["context"],
  ): Promise<AlarmDraft[]> {
    const text = await this.transcriber.transcribe(audio);
    return this.parseAlarms.execute({ text, context });
  }
}
