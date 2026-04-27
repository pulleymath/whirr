import { MEETING_MINUTES_MAX_CUSTOM_TEMPLATE_LENGTH } from "@/lib/api/meeting-minutes-api-constants";
import { describe, expect, it } from "vitest";
import { parseMeetingMinutesTemplateFromRequest } from "../parse-template";
import { DEFAULT_MEETING_MINUTES_TEMPLATE } from "../templates";

describe("parseMeetingMinutesTemplateFromRequest", () => {
  it("undefined면 기본 템플릿", () => {
    expect(parseMeetingMinutesTemplateFromRequest(undefined)).toEqual({
      ok: true,
      value: DEFAULT_MEETING_MINUTES_TEMPLATE,
    });
  });

  it("null이면 기본 템플릿", () => {
    expect(parseMeetingMinutesTemplateFromRequest(null)).toEqual({
      ok: true,
      value: DEFAULT_MEETING_MINUTES_TEMPLATE,
    });
  });

  it("내장 id는 허용", () => {
    expect(
      parseMeetingMinutesTemplateFromRequest({ id: "informationSharing" }),
    ).toEqual({ ok: true, value: { id: "informationSharing" } });
  });

  it("custom에 문자열 prompt면 trim 반환", () => {
    expect(
      parseMeetingMinutesTemplateFromRequest({
        id: "custom",
        prompt: "  ## A\n",
      }),
    ).toEqual({ ok: true, value: { id: "custom", prompt: "## A" } });
  });

  it("custom prompt가 비어 있으면 기본 템플릿", () => {
    expect(
      parseMeetingMinutesTemplateFromRequest({ id: "custom", prompt: "  " }),
    ).toEqual({ ok: true, value: DEFAULT_MEETING_MINUTES_TEMPLATE });
  });

  it("prompt가 한도 초과면 실패", () => {
    const r = parseMeetingMinutesTemplateFromRequest({
      id: "custom",
      prompt: "x".repeat(MEETING_MINUTES_MAX_CUSTOM_TEMPLATE_LENGTH + 1),
    });
    expect(r).toEqual({ ok: false, error: "template.prompt too long" });
  });

  it("배열이면 invalid template", () => {
    expect(parseMeetingMinutesTemplateFromRequest([])).toEqual({
      ok: false,
      error: "invalid template",
    });
  });

  it("알 수 없는 id면 invalid template", () => {
    expect(parseMeetingMinutesTemplateFromRequest({ id: "nope" })).toEqual({
      ok: false,
      error: "invalid template",
    });
  });

  it("custom인데 prompt가 string이 아니면 invalid template", () => {
    expect(
      parseMeetingMinutesTemplateFromRequest({ id: "custom", prompt: 1 }),
    ).toEqual({ ok: false, error: "invalid template" });
  });
});
