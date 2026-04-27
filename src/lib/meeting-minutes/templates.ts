/**
 * 회의록 출력 형식 템플릿. 회의 사실 정보(SessionContext)와 분리한다.
 */

export type BuiltInMeetingMinutesTemplateId =
  | "default"
  | "informationSharing"
  | "business";

export type MeetingMinutesTemplateId =
  | BuiltInMeetingMinutesTemplateId
  | "custom";

export type MeetingMinutesTemplate =
  | { id: BuiltInMeetingMinutesTemplateId }
  | { id: "custom"; prompt: string };

export const DEFAULT_MEETING_MINUTES_TEMPLATE = { id: "default" } as const;

export const MEETING_MINUTES_TEMPLATE_OPTIONS = [
  {
    value: "default" as const,
    label: "기본회의",
    hint: "논의, 결정, 액션 아이템 중심",
  },
  {
    value: "informationSharing" as const,
    label: "정보전달",
    hint: "강연·세션·교육 내용을 학습 노트처럼 정리",
  },
  {
    value: "business" as const,
    label: "비즈니스 미팅",
    hint: "니즈, 조건, 합의, 리스크 중심",
  },
  {
    value: "custom" as const,
    label: "직접입력",
    hint: "내가 적은 형식 지침을 회의록 프롬프트에 반영",
  },
] as const;

const TEMPLATE_SECTION_HEADER = "## 회의록 템플릿 지침";

function builtInInstructionBody(id: BuiltInMeetingMinutesTemplateId): string {
  switch (id) {
    case "default":
      return (
        `아래 Markdown 구조로 한국어 회의록을 작성하세요. 스크립트에 없는 내용은 추측하지 마세요.\n` +
        `- 요약\n` +
        `- 주요 논의\n` +
        `- 결정 사항\n` +
        `- 액션 아이템 (담당·기한이 언급되면 포함)\n` +
        `- 열린 이슈`
      );
    case "informationSharing":
      return (
        `이 스크립트는 **정보 전달**(강연, 세션, 교육, 발표 등)에 가깝다고 가정하고, 한국어로 정리하세요. ` +
        `스크립트에 없는 내용은 추측하지 마세요.\n` +
        `아래 Markdown 구조를 따르세요.\n` +
        `- 핵심 메시지\n` +
        `- 세션 흐름 (섹션 순서·전환)\n` +
        `- 주요 개념 (용어·정의)\n` +
        `- 중요한 내용 (다시 봐야 할 설명)\n` +
        `- 예시 / 근거 (언급된 사례·숫자·비교)\n` +
        `- Q&A (질문과 답변)\n` +
        `- 후속 참고사항 (추가로 읽을 자료, 확인할 점)`
      );
    case "business":
      return (
        `이 스크립트는 **비즈니스 미팅**에 가깝다고 가정하고, 한국어로 정리하세요. ` +
        `스크립트에 없는 내용은 추측하지 마세요.\n` +
        `아래 Markdown 구조를 따르세요.\n` +
        `- 목적 / 상대 니즈\n` +
        `- 제안 / 조건\n` +
        `- 쟁점\n` +
        `- 합의 사항 / 미합의 사항\n` +
        `- 다음 액션\n` +
        `- 리스크`
      );
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/**
 * 시스템 프롬프트에 붙일 템플릿 지침 블록(한 덩어리).
 * `custom`이고 prompt가 비어 있으면 기본회의 지침과 동일한 문자열을 반환한다.
 */
export function renderMeetingMinutesTemplateInstruction(
  template: MeetingMinutesTemplate,
): string {
  if (template.id === "custom") {
    const trimmed = template.prompt.trim();
    if (trimmed.length === 0) {
      return renderMeetingMinutesTemplateInstruction(
        DEFAULT_MEETING_MINUTES_TEMPLATE,
      );
    }
    return (
      `${TEMPLATE_SECTION_HEADER}\n` +
      `아래 블록은 **출력 형식·섹션 구성 지침**일 뿐입니다. ` +
      `회의 내용·사실은 오직 주어진 스크립트와 회의 정보에서만 가져오세요. ` +
      `지침에 없는 사실을 만들지 마세요.\n\n` +
      `--- 사용자 지정 템플릿 시작 ---\n` +
      `${trimmed}\n` +
      `--- 사용자 지정 템플릿 끝 ---`
    );
  }
  return `${TEMPLATE_SECTION_HEADER}\n${builtInInstructionBody(template.id)}`;
}

export function resolveMeetingMinutesTemplate(
  template: MeetingMinutesTemplate | undefined | null,
): MeetingMinutesTemplate {
  if (template == null) {
    return DEFAULT_MEETING_MINUTES_TEMPLATE;
  }
  if (template.id === "custom" && template.prompt.trim().length === 0) {
    return DEFAULT_MEETING_MINUTES_TEMPLATE;
  }
  return template;
}
