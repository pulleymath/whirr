import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEETING_MINUTES_TEMPLATE,
  MEETING_MINUTES_TEMPLATE_OPTIONS,
  renderMeetingMinutesTemplateInstruction,
} from "../templates";

describe("meeting minutes templates", () => {
  it("exposes default, informationSharing, business, and custom options", () => {
    expect(MEETING_MINUTES_TEMPLATE_OPTIONS.map((o) => o.value)).toEqual([
      "default",
      "informationSharing",
      "business",
      "custom",
    ]);
  });

  it("default template instructions include core meeting sections", () => {
    const out = renderMeetingMinutesTemplateInstruction({
      id: "default",
    });
    expect(out).toContain("## 회의록 템플릿 지침");
    expect(out).toContain("요약");
    expect(out).toContain("주요 논의");
    expect(out).toContain("결정 사항");
    expect(out).toContain("액션 아이템");
    expect(out).toContain("열린 이슈");
  });

  it("renders information-sharing output instructions", () => {
    const out = renderMeetingMinutesTemplateInstruction({
      id: "informationSharing",
    });
    expect(out).toContain("핵심 메시지");
    expect(out).toContain("세션 흐름");
    expect(out).toContain("Q&A");
    expect(out).toContain("예시 / 근거");
    expect(out).toContain("후속 참고사항");
  });

  it("renders business meeting output instructions", () => {
    const out = renderMeetingMinutesTemplateInstruction({ id: "business" });
    expect(out).toContain("목적 / 상대 니즈");
    expect(out).toContain("제안 / 조건");
    expect(out).toContain("쟁점");
    expect(out).toContain("합의 사항 / 미합의 사항");
    expect(out).toContain("다음 액션");
    expect(out).toContain("리스크");
  });

  it("custom prompt is trimmed and wrapped as custom instruction", () => {
    const out = renderMeetingMinutesTemplateInstruction({
      id: "custom",
      prompt: "  ## 나만의 섹션\n- A  ",
    });
    expect(out).toContain("--- 사용자 지정 템플릿 시작 ---");
    expect(out).toContain("--- 사용자 지정 템플릿 끝 ---");
    expect(out).toContain("## 나만의 섹션");
    expect(out).toContain("출력 형식·섹션 구성 지침");
    expect(out).not.toMatch(/^\s+## 나만의/);
  });

  it("empty custom prompt falls back to default instructions", () => {
    expect(
      renderMeetingMinutesTemplateInstruction({ id: "custom", prompt: "  " }),
    ).toBe(
      renderMeetingMinutesTemplateInstruction(DEFAULT_MEETING_MINUTES_TEMPLATE),
    );
  });
});
