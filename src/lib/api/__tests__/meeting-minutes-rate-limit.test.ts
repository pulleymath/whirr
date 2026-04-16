import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMeetingMinutesRateLimited,
  resetMeetingMinutesRateLimitForTests,
} from "../meeting-minutes-rate-limit";

describe("meeting-minutes-rate-limit", () => {
  beforeEach(() => {
    resetMeetingMinutesRateLimitForTests();
    vi.unstubAllEnvs();
  });

  it("MEETING_MINUTES_RATE_LIMIT_MAX를 넘기면 true", () => {
    vi.stubEnv("MEETING_MINUTES_RATE_LIMIT_MAX", "2");
    vi.stubEnv("MEETING_MINUTES_RATE_LIMIT_WINDOW_MS", "60000");
    expect(isMeetingMinutesRateLimited("k", 1_000_000)).toBe(false);
    expect(isMeetingMinutesRateLimited("k", 1_000_001)).toBe(false);
    expect(isMeetingMinutesRateLimited("k", 1_000_002)).toBe(true);
  });
});
