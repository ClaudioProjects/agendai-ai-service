import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";
export type AudioInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};
export interface AudioTranscriber {
  transcribe(input: AudioInput): Promise<string>;
}
export interface AlarmParser {
  parse(input: ParseInput): Promise<AlarmDraft[]>;
}
