import { describe, expect, it } from "vitest";
import {
  buildSystemPromptWithContext,
  MEETING_MINUTES_SINGLE_SYSTEM,
} from "../prompts";
import type { MeetingContext } from "@/lib/glossary/types";

describe("buildSystemPromptWithContext", () => {
  it("context가 null이면 basePrompt를 그대로 반환한다", () => {
    expect(buildSystemPromptWithContext("BASE", null)).toBe("BASE");
  });

  it("glossary가 비어 있고 sessionContext가 null이면 기본 템플릿 지침만 추가한다", () => {
    const ctx: MeetingContext = { glossary: [], sessionContext: null };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out.startsWith("BASE")).toBe(true);
    expect(out).toContain("## 회의록 템플릿 지침");
    expect(out).toContain("요약");
  });

  it("glossary 항목이 있으면 용어 교정 가이드 섹션을 추가한다", () => {
    const ctx: MeetingContext = {
      glossary: ["Kubernetes"],
      sessionContext: null,
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("BASE");
    expect(out).toContain("## 용어 교정 가이드");
    expect(out).toContain("- Kubernetes");
  });

  it("sessionContext.participants가 있으면 회의 참석자 섹션을 추가한다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: {
        participants: "김철수, 이영희",
        topic: "",
        keywords: "",
      },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("## 회의 참석자");
    expect(out).toContain("김철수, 이영희");
  });

  it("sessionContext.topic이 있으면 회의 주제 섹션을 추가한다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: {
        participants: "",
        topic: "분기 계획",
        keywords: "",
      },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("## 회의 주제");
    expect(out).toContain("분기 계획");
  });

  it("sessionContext.keywords가 있으면 이번 회의 키워드 섹션을 추가한다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: {
        participants: "",
        topic: "",
        keywords: "OKR, 리스크",
      },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("## 이번 회의 키워드");
    expect(out).toContain("OKR, 리스크");
  });

  it("공백만 있는 sessionContext 필드는 무시하고 템플릿 지침은 붙인다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: {
        participants: "  \n  ",
        topic: "   ",
        keywords: "\t",
      },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out.startsWith("BASE")).toBe(true);
    expect(out).toContain("## 회의록 템플릿 지침");
    expect(out).not.toContain("## 회의 참석자");
  });

  it("template이 informationSharing이면 해당 지침이 포함된다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: null,
      template: { id: "informationSharing" },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("핵심 메시지");
    expect(out).toContain("세션 흐름");
  });

  it("template이 custom이면 사용자 지정 블록과 지침 문구가 포함된다", () => {
    const ctx: MeetingContext = {
      glossary: [],
      sessionContext: null,
      template: { id: "custom", prompt: "## 나만의\n- 항목" },
    };
    const out = buildSystemPromptWithContext("BASE", ctx);
    expect(out).toContain("--- 사용자 지정 템플릿 시작 ---");
    expect(out).toContain("출력 형식·섹션 구성 지침");
    expect(out).toContain("## 나만의");
  });

  it("glossary + sessionContext 모두 있으면 모든 섹션이 포함된다", () => {
    const ctx: MeetingContext = {
      glossary: ["Vercel"],
      sessionContext: {
        participants: "A",
        topic: "B",
        keywords: "C",
      },
    };
    const out = buildSystemPromptWithContext(
      MEETING_MINUTES_SINGLE_SYSTEM,
      ctx,
    );
    expect(out).toContain("용어 교정 가이드");
    expect(out).toContain("- Vercel");
    expect(out).toContain("## 회의 참석자");
    expect(out).toContain("## 회의 주제");
    expect(out).toContain("## 이번 회의 키워드");
  });
});
