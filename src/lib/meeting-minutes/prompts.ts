import type { MeetingContext } from "@/lib/glossary/types";
import {
  renderMeetingMinutesTemplateInstruction,
  resolveMeetingMinutesTemplate,
} from "./templates";

export const MEETING_MINUTES_SINGLE_SYSTEM = `당신은 회의록 작성 보조입니다. 주어진 스크립트 전체를 바탕으로 한국어 회의록을 작성합니다.
논점, 결정 사항, 액션 아이템(담당·기한이 언급되면 포함), 열린 이슈를 빠짐없이 정리하세요.`;

export const MEETING_MINUTES_MAP_SYSTEM = `당신은 회의록 작성 보조입니다. 스크립트의 **이 구간만** 다룹니다.
이 구간의 논의 요지, 결정, 할 일, 주의할 점을 한국어로 구조화해 정리하세요. 다른 구간을 추측하지 마세요.`;

export const MEETING_MINUTES_REDUCE_SYSTEM = `당신은 회의록 편집자입니다. 여러 구간으로 나뉜 부분 회의록을 **하나의 완성된 회의록**으로 합칩니다.
중복을 제거하고, 시간·주제 흐름이 자연스럽게 이어지게 하며, 앞부분·중간·뒷부분 어느 것도 빠뜨리지 마세요.`;

export function buildSystemPromptWithContext(
  basePrompt: string,
  context: MeetingContext | null,
): string {
  if (!context) {
    return basePrompt;
  }

  const hasGlossary = context.glossary.length > 0;
  const sc = context.sessionContext;
  const hasSession =
    sc != null &&
    (sc.participants.trim().length > 0 ||
      sc.topic.trim().length > 0 ||
      sc.keywords.trim().length > 0);

  const sections: string[] = [basePrompt];

  if (hasGlossary) {
    sections.push(
      `\n\n## 용어 교정 가이드\n` +
        `아래는 회의에서 사용된 전문 용어·고유명사입니다. ` +
        `STT가 이 용어를 잘못 전사했을 수 있으니 ` +
        `문맥에 맞게 올바른 표기로 교정하세요.\n` +
        context.glossary.map((t) => `- ${t}`).join("\n"),
    );
  }

  if (sc && hasSession) {
    if (sc.participants.trim()) {
      sections.push(`\n\n## 회의 참석자\n${sc.participants.trim()}`);
    }
    if (sc.topic.trim()) {
      sections.push(`\n\n## 회의 주제\n${sc.topic.trim()}`);
    }
    if (sc.keywords.trim()) {
      sections.push(`\n\n## 이번 회의 키워드\n${sc.keywords.trim()}`);
    }
  }

  const effectiveTemplate = resolveMeetingMinutesTemplate(context.template);
  sections.push(
    `\n\n${renderMeetingMinutesTemplateInstruction(effectiveTemplate)}`,
  );

  return sections.join("");
}
