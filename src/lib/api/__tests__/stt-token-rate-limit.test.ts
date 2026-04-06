import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientKeyFromRequest,
  isSttTokenRateLimited,
  resetSttTokenRateLimitForTests,
} from "../stt-token-rate-limit";

describe("stt-token-rate-limit", () => {
  beforeEach(() => {
    resetSttTokenRateLimitForTests();
    vi.unstubAllEnvs();
  });

  it("x-forwarded-for의 첫 IP를 클라이언트 키로 쓴다", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(getClientKeyFromRequest(req)).toBe("203.0.113.1");
  });

  it("x-real-ip이 있으면 사용한다", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientKeyFromRequest(req)).toBe("198.51.100.2");
  });

  it("헤더가 없으면 unknown", () => {
    expect(getClientKeyFromRequest(new Request("http://x"))).toBe("unknown");
  });

  it("STT_TOKEN_RATE_LIMIT_MAX를 넘기면 true", () => {
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_MAX", "2");
    vi.stubEnv("STT_TOKEN_RATE_LIMIT_WINDOW_MS", "60000");
    expect(isSttTokenRateLimited("k", 1_000_000)).toBe(false);
    expect(isSttTokenRateLimited("k", 1_000_001)).toBe(false);
    expect(isSttTokenRateLimited("k", 1_000_002)).toBe(true);
  });
});
