import { describe, expect, test } from "bun:test";
import { normalizeCapturedAudioMimeType } from "../src/libs/audio-mime";

describe("normalizeCapturedAudioMimeType", () => {
  test("canonicalizes Android WebView audio-only recordings labeled as video", () => {
    expect(normalizeCapturedAudioMimeType("video/webm")).toBe("audio/webm");
    expect(normalizeCapturedAudioMimeType("video/webm; codecs=opus")).toBe(
      "audio/webm",
    );
    expect(normalizeCapturedAudioMimeType("video/mp4")).toBe("audio/mp4");
  });

  test("keeps supported audio media types canonical", () => {
    expect(normalizeCapturedAudioMimeType("audio/webm;codecs=opus")).toBe(
      "audio/webm",
    );
    expect(normalizeCapturedAudioMimeType("audio/ogg")).toBe("audio/ogg");
  });
});
