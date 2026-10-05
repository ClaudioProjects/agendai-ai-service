import { describe, expect, test } from "bun:test";
import type { ClientOptions } from "openai";
import type { AudioParseInput } from "../src/contracts/ai";
import { OpenAIAudioAlarmParser } from "../src/providers/ai/openai-audio-alarm-parser";
import type { AlarmDraft } from "../src/schemas/alarm";

const draft: AlarmDraft = {
  id: null,
  reminderType: "pay_bill",
  amount: 150.5,
  eventType: "FINANCE",
  date: "2026-10-06",
  time: "14:00",
  recurrence: null,
  notifications: null,
  status: null,
  createdAt: null,
  updatedAt: null,
  exceptions: null,
  title: "Pagar conta de luz",
  description: null,
  eventColor: null,
};
const input: AudioParseInput = {
  audio: {
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "audio/wav",
    fileName: "request.wav",
  },
  context: {
    currentDateTime: "2026-10-05T10:00:00-03:00",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
  },
};
const toolCall = (argumentsValue: string) => ({
  id: "call-1",
  type: "function",
  function: { name: "return_alarm_drafts", arguments: argumentsValue },
});
const completion = (argumentsValue: string) => ({
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        refusal: null,
        tool_calls: [toolCall(argumentsValue)],
      },
    },
  ],
});

function fixture(response: unknown, status = 200) {
  const requests: Request[] = [];
  const fetch: NonNullable<ClientOptions["fetch"]> = async (url, init) => {
    requests.push(new Request(url, init));
    return Response.json(response, { status });
  };
  return {
    parser: new OpenAIAudioAlarmParser(
      "test-key",
      "gpt-audio-1.5",
      1000,
      fetch,
    ),
    requests,
  };
}

describe("OpenAI audio alarm interpretation", () => {
  test("sends audio and temporal context in one chat completion and returns multiple validated drafts", async () => {
    const drafts = [draft, { ...draft, title: "Pagar internet", amount: 99.9 }];
    const { parser, requests } = fixture(
      completion(JSON.stringify({ drafts })),
    );
    expect(await parser.parse(input)).toEqual(drafts);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    const body = await requests[0]!.json();
    expect(body.model).toBe("gpt-audio-1.5");
    expect(body.modalities).toEqual(["text"]);
    expect(body.store).toBe(false);
    expect(body.messages[1].content).toEqual([
      { type: "text", text: JSON.stringify({ context: input.context }) },
      { type: "input_audio", input_audio: { data: "AQID", format: "wav" } },
    ]);
    expect(body.tools[0].function.strict).toBe(false);
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "return_alarm_drafts" },
    });
  });

  test("sends MP3 with its actual format", async () => {
    const { parser, requests } = fixture(completion('{"drafts":[]}'));
    expect(
      await parser.parse({
        ...input,
        audio: { ...input.audio, mimeType: "audio/mpeg" },
      }),
    ).toEqual([]);
    const body = await requests[0]!.json();
    expect(body.messages[1].content[1].input_audio.format).toBe("mp3");
    expect(requests).toHaveLength(1);
  });

  test.each([
    "not json",
    JSON.stringify({ drafts: [{ ...draft, time: "25:00" }] }),
    JSON.stringify({ drafts: [{ ...draft, title: " " }] }),
    JSON.stringify({ drafts: [{ ...draft, amount: -1 }] }),
    JSON.stringify({ drafts: [{ title: "Missing fields" }] }),
    JSON.stringify({ drafts: [], extra: true }),
    "[]",
  ])(
    "rejects malformed or invalid alarm arguments without another call: %s",
    async (argumentsValue) => {
      const { parser, requests } = fixture(completion(argumentsValue));
      await expect(parser.parse(input)).rejects.toMatchObject({
        code: "INVALID_AI_RESPONSE",
        status: 502,
      });
      expect(requests).toHaveLength(1);
    },
  );

  test.each([
    { choices: [] },
    {
      choices: [
        { finish_reason: "stop", message: { content: "Just a transcription" } },
      ],
    },
    {
      choices: [
        {
          finish_reason: "length",
          message: { tool_calls: [toolCall('{"drafts":[]}')] },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            refusal: "Refused",
            tool_calls: [toolCall('{"drafts":[]}')],
          },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            tool_calls: [toolCall('{"drafts":[]}'), toolCall('{"drafts":[]}')],
          },
        },
      ],
    },
    {
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            tool_calls: [
              {
                ...toolCall('{"drafts":[]}'),
                function: { name: "other", arguments: '{"drafts":[]}' },
              },
            ],
          },
        },
      ],
    },
  ])("rejects an incomplete or unexpected completion", async (response) => {
    const { parser, requests } = fixture(response);
    await expect(parser.parse(input)).rejects.toMatchObject({
      code: "INVALID_AI_RESPONSE",
      status: 502,
    });
    expect(requests).toHaveLength(1);
  });

  test.each([429, 500, 503])(
    "maps provider status %d to unavailable without retries",
    async (status) => {
      const { parser, requests } = fixture(
        { error: { message: "Unavailable", type: "server_error" } },
        status,
      );
      await expect(parser.parse(input)).rejects.toMatchObject({
        code: "PROVIDER_UNAVAILABLE",
        status: 503,
      });
      expect(requests).toHaveLength(1);
    },
  );

  test("maps connection failures without retries", async () => {
    let calls = 0;
    const parser = new OpenAIAudioAlarmParser(
      "test-key",
      "gpt-audio-1.5",
      1000,
      async () => {
        calls++;
        throw new Error("Connection failed");
      },
    );
    await expect(parser.parse(input)).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      status: 503,
    });
    expect(calls).toBe(1);
  });

  test("rejects recorder formats before any provider request", async () => {
    const { parser, requests } = fixture(completion('{"drafts":[]}'));
    await expect(
      parser.parse({
        ...input,
        audio: { ...input.audio, mimeType: "audio/webm" },
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_AUDIO", status: 415 });
    expect(requests).toHaveLength(0);
  });
});
