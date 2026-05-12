import type { SessionContext } from "@/lib/glossary/types";

/** API·저장용: 세 필드가 모두 비어 있으면 `null`(컨텍스트 생략). */
export function sessionContextForApi(
  value: SessionContext,
): SessionContext | null {
  if (
    !value.participants.trim() &&
    !value.topic.trim() &&
    !value.keywords.trim()
  ) {
    return null;
  }
  return value;
}
