import { describe, expect, it } from "vitest";

describe("vitest 환경", () => {
  it("vitest describe/it가 런타임에서 동작한다", () => {
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
  });

  it("TypeScript 타입 추론이 동작한다", () => {
    const n: number = 1;
    expect(n).toBe(1);
  });
});
