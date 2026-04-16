import { describe, expect, it } from "vitest";
import { chunkText } from "../chunk-text";

describe("chunkText", () => {
  it("빈 문자열이면 빈 배열", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
  });

  it("짧은 텍스트는 단일 청크", () => {
    expect(chunkText("짧은 내용.", { chunkSize: 100 })).toEqual(["짧은 내용."]);
  });

  it("chunkSize 이하 단일 청크", () => {
    const s = "a".repeat(50);
    expect(chunkText(s, { chunkSize: 100 })).toEqual([s]);
  });

  it("긴 텍스트는 여러 청크로 분할된다", () => {
    const part = `${"단어 ".repeat(20).trim()}. `; // 문장 단위
    const long = part.repeat(400);
    const chunks = chunkText(long, { chunkSize: 500, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(500);
    }
  });

  it("연속 청크 사이에 오버랩 구간이 있다", () => {
    const sentence = "문장입니다. ";
    const body = sentence.repeat(800);
    const chunks = chunkText(body, { chunkSize: 400, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    let foundOverlap = false;
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1]!;
      const cur = chunks[i]!;
      for (let len = 10; len <= 50; len++) {
        const tail = prev.slice(-len);
        if (tail.length > 0 && cur.includes(tail)) {
          foundOverlap = true;
          break;
        }
      }
    }
    expect(foundOverlap).toBe(true);
  });
});
