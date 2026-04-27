import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TRANSCRIPTION_SETTINGS,
  parseTranscriptionSettings,
} from "../types";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseTranscriptionSettings", () => {
  it("undefined면 전 필드 기본값", () => {
    expect(parseTranscriptionSettings(undefined)).toEqual(
      DEFAULT_TRANSCRIPTION_SETTINGS,
    );
  });

  it("부분 객체면 나머지는 기본값 유지", () => {
    expect(parseTranscriptionSettings({ mode: "batch" })).toEqual({
      ...DEFAULT_TRANSCRIPTION_SETTINGS,
      mode: "batch",
    });
  });

  it("잘못된 mode 문자열은 기본값 batch", () => {
    expect(parseTranscriptionSettings({ mode: "nope" })).toMatchObject({
      mode: "batch",
    });
  });

  it("production에서는 저장된 mode를 무시하고 batch", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      parseTranscriptionSettings({ mode: "realtime" }),
    ).toMatchObject({ mode: "batch" });
  });

  it("잘못된 realtimeEngine은 기본값 openai", () => {
    expect(
      parseTranscriptionSettings({ realtimeEngine: "other" }),
    ).toMatchObject({
      realtimeEngine: "openai",
    });
  });

  it("빈 batchModel 문자열은 무시하고 기본값", () => {
    expect(parseTranscriptionSettings({ batchModel: "" })).toMatchObject({
      batchModel: DEFAULT_TRANSCRIPTION_SETTINGS.batchModel,
    });
  });

  it("meetingMinutesModel 기본값은 gpt-5.4-nano", () => {
    expect(parseTranscriptionSettings(undefined)).toMatchObject({
      meetingMinutesModel: "gpt-5.4-nano",
    });
  });

  it("meetingMinutesModel 문자열이 있으면 파싱한다", () => {
    expect(
      parseTranscriptionSettings({ meetingMinutesModel: "gpt-4o" }),
    ).toMatchObject({
      meetingMinutesModel: "gpt-4o",
    });
  });

  it("빈 meetingMinutesModel 문자열은 기본값", () => {
    expect(
      parseTranscriptionSettings({ meetingMinutesModel: "" }),
    ).toMatchObject({
      meetingMinutesModel: DEFAULT_TRANSCRIPTION_SETTINGS.meetingMinutesModel,
    });
  });

  it("허용 목록에 없는 meetingMinutesModel은 기본값으로 폴백", () => {
    expect(
      parseTranscriptionSettings({ meetingMinutesModel: "custom-model" }),
    ).toMatchObject({
      meetingMinutesModel: DEFAULT_TRANSCRIPTION_SETTINGS.meetingMinutesModel,
    });
  });
});
