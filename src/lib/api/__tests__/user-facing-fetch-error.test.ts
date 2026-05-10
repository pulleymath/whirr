import { describe, expect, it } from "vitest";
import { userFacingHttpErrorMessage } from "../user-facing-fetch-error";

describe("userFacingHttpErrorMessage", () => {
  it("429는 고정 한국어 안내", () => {
    expect(userFacingHttpErrorMessage(429, "Too many requests")).toBe(
      "요청이 많아 잠시 후 다시 시도해 주세요.",
    );
  });

  it("그 외 status는 서버 메시지가 있으면 그대로", () => {
    expect(userFacingHttpErrorMessage(413, "text too long")).toBe("text too long");
  });

  it("서버 메시지가 없으면 기본 한국어", () => {
    expect(userFacingHttpErrorMessage(500, null)).toBe("요청에 실패했습니다.");
  });
});
