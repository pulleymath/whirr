import { describe, expect, it } from "vitest";
import { buildSessionText } from "../build-session-text";

describe("buildSessionText", () => {
  it("finals만 있을 때 공백으로 이어붙인 문자열을 반환한다", () => {
    expect(buildSessionText(["hello", "world"], "")).toBe("hello world");
  });

  it("partial만 비어 있지 않을 때 해당 문자열만 반환한다", () => {
    expect(buildSessionText([], "  typing  ")).toBe("typing");
  });

  it("finals와 partial이 모두 있을 때 join 후 partial을 trim해 결합한다", () => {
    expect(buildSessionText(["foo", "bar"], " baz ")).toBe("foo bar baz");
  });

  it("빈 배열과 빈 partial이면 빈 문자열이다", () => {
    expect(buildSessionText([], "")).toBe("");
  });

  it("공백만 있는 finals 항목은 제외한다", () => {
    expect(buildSessionText(["  ", "a", ""], "")).toBe("a");
  });
});
