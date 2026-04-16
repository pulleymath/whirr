import type { MeetingContext } from "@/lib/glossary/types";
import { chunkText } from "./chunk-text";
import { MEETING_MINUTES_MAP_CONCURRENCY } from "./constants";
import {
  buildSystemPromptWithContext,
  MEETING_MINUTES_MAP_SYSTEM,
  MEETING_MINUTES_REDUCE_SYSTEM,
  MEETING_MINUTES_SINGLE_SYSTEM,
} from "./prompts";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 테스트에서 주입하는 OpenAI Chat 호출 대체 구현. */
export type CompleteChatFn = (args: {
  model: string;
  messages: ChatMessage[];
}) => Promise<string>;

export async function openAiChatCompletion(
  apiKey: string,
  args: { model: string; messages: ChatMessage[] },
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI: empty completion");
  }
  return content;
}

/**
 * 스크립트 전문을 회의록으로 변환한다. 긴 본문은 청크 map → 단일 reduce로 합친다.
 */
export async function generateMeetingMinutes(
  text: string,
  options: {
    model: string;
    completeChat: CompleteChatFn;
    context?: MeetingContext | null;
  },
): Promise<string> {
  const { model, completeChat, context } = options;
  const ctx = context ?? null;
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error("empty text");
  }

  if (chunks.length === 1) {
    return completeChat({
      model,
      messages: [
        {
          role: "system",
          content: buildSystemPromptWithContext(
            MEETING_MINUTES_SINGLE_SYSTEM,
            ctx,
          ),
        },
        {
          role: "user",
          content: `다음은 회의 스크립트입니다.\n\n${chunks[0]}`,
        },
      ],
    });
  }

  const mapSystem = buildSystemPromptWithContext(
    MEETING_MINUTES_MAP_SYSTEM,
    ctx,
  );

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i += MEETING_MINUTES_MAP_CONCURRENCY) {
    const slice = chunks.slice(i, i + MEETING_MINUTES_MAP_CONCURRENCY);
    const batch = await Promise.all(
      slice.map((chunk, bi) => {
        const idx = i + bi;
        return completeChat({
          model,
          messages: [
            { role: "system", content: mapSystem },
            {
              role: "user",
              content: `[구간 ${idx + 1}/${chunks.length}]\n\n${chunk}`,
            },
          ],
        });
      }),
    );
    parts.push(...batch);
  }

  const merged = parts
    .map((p, i) => `### 구간 ${i + 1} 부분 회의록\n${p}`)
    .join("\n\n");

  return completeChat({
    model,
    messages: [
      { role: "system", content: MEETING_MINUTES_REDUCE_SYSTEM },
      { role: "user", content: merged },
    ],
  });
}
