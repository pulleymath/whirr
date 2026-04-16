import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMeetingMinutes } from "../map-reduce";

describe("generateMeetingMinutes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("단일 청크면 completeChat 1회(map+reduce 없음)", async () => {
    const completeChat = vi.fn().mockResolvedValue("최종 회의록");
    const out = await generateMeetingMinutes("짧은 전사입니다.", {
      model: "gpt-5.4-nano",
      completeChat,
    });
    expect(out).toBe("최종 회의록");
    expect(completeChat).toHaveBeenCalledTimes(1);
  });

  it("다수 청크면 map N회 + reduce 1회", async () => {
    const unit = "문장입니다. ";
    const long = unit.repeat(3000);
    const completeChat = vi.fn().mockImplementation(async ({ messages }) => {
      const last = messages[messages.length - 1]?.content ?? "";
      if (last.includes("부분 회의록") || last.startsWith("### 구간")) {
        return "합친 회의록";
      }
      return "부분";
    });
    const out = await generateMeetingMinutes(long, {
      model: "m",
      completeChat,
    });
    expect(out).toBe("합친 회의록");
    const mapPlusReduce = completeChat.mock.calls.length;
    expect(mapPlusReduce).toBeGreaterThanOrEqual(3);
  });

  it("map 중 하나가 실패하면 전체 reject", async () => {
    const unit = "문장입니다. ";
    const long = unit.repeat(3000);
    let n = 0;
    const completeChat = vi.fn().mockImplementation(async () => {
      n += 1;
      if (n === 2) {
        throw new Error("fail chunk");
      }
      return "부분";
    });
    await expect(
      generateMeetingMinutes(long, { model: "m", completeChat }),
    ).rejects.toThrow("fail chunk");
  });

  it("빈 전사면 에러", async () => {
    await expect(
      generateMeetingMinutes("  ", {
        model: "m",
        completeChat: vi.fn(),
      }),
    ).rejects.toThrow("empty text");
  });
});
