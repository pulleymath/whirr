import { describe, expect, it } from "vitest";
import {
  createWebSpeechNoSpeechDebouncer,
  parseWebSpeechProviderError,
  userFacingWebSpeechErrorCode,
} from "../user-facing-error";

describe("userFacingWebSpeechErrorCode", () => {
  it("not-allowed", () => {
    expect(userFacingWebSpeechErrorCode("not-allowed")).toBe(
      "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.",
    );
  });

  it("no-speech", () => {
    expect(userFacingWebSpeechErrorCode("no-speech")).toBe(
      "음성이 감지되지 않았습니다. 마이크를 확인해 주세요.",
    );
  });

  it("audio-capture", () => {
    expect(userFacingWebSpeechErrorCode("audio-capture")).toBe(
      "마이크를 찾을 수 없습니다.",
    );
  });

  it("network", () => {
    expect(userFacingWebSpeechErrorCode("network")).toBe(
      "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.",
    );
  });

  it("알 수 없는 코드는 일반 문구", () => {
    expect(userFacingWebSpeechErrorCode("bogus")).toBe(
      "음성 인식 중 오류가 발생했습니다.",
    );
  });
});

describe("parseWebSpeechProviderError", () => {
  it("WEB_SPEECH: 접두가 있으면 코드를 반환한다", () => {
    expect(parseWebSpeechProviderError("WEB_SPEECH:network")).toBe("network");
  });

  it("접두가 없으면 null", () => {
    expect(parseWebSpeechProviderError("other")).toBeNull();
  });
});

describe("createWebSpeechNoSpeechDebouncer", () => {
  it("3초 이내 반복이면 두 번째는 false", () => {
    const d = createWebSpeechNoSpeechDebouncer(3000);
    expect(d.shouldReport(1000)).toBe(true);
    expect(d.shouldReport(2000)).toBe(false);
    expect(d.shouldReport(3999)).toBe(false);
    expect(d.shouldReport(4000)).toBe(true);
  });

  it("reset 후 다시 보고 가능", () => {
    const d = createWebSpeechNoSpeechDebouncer(3000);
    expect(d.shouldReport(0)).toBe(true);
    expect(d.shouldReport(1000)).toBe(false);
    d.reset();
    expect(d.shouldReport(1000)).toBe(true);
  });
});
