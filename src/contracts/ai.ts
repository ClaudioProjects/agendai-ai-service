import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
export type AudioInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};
export type AudioParseInput = {
  audio: AudioInput;
  context: ParseInput["context"];
};
export interface AudioAlarmParser {
  parse(input: AudioParseInput): Promise<AlarmDraft[]>;
}
export interface AlarmParser {
  parse(input: ParseInput): Promise<AlarmDraft[]>;
}
