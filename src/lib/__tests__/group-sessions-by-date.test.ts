import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/db";
import {
  groupSessionsByDate,
  localDateKeyFromTimestamp,
} from "@/lib/group-sessions-by-date";
import {
  previewSessionText,
  SESSION_LIST_PREVIEW_MAX,
} from "@/lib/session-preview";

function session(partial: Partial<Session> & Pick<Session, "id">): Session {
  return {
    text: "",
    createdAt: 0,
    ...partial,
  };
}

describe("groupSessionsByDate", () => {
  it("같은 로컬 날짜의 세션을 한 그룹으로 묶는다", () => {
    const noon = new Date(2024, 5, 15, 12, 0, 0).getTime();
    const evening = new Date(2024, 5, 15, 22, 30, 0).getTime();
    const sessions = [
      session({ id: "a", createdAt: evening, text: "b" }),
      session({ id: "b", createdAt: noon, text: "a" }),
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("서로 다른 날짜는 별도 그룹이며 날짜 키는 최신순이다", () => {
    const june15 = new Date(2024, 5, 15, 10, 0, 0).getTime();
    const june14 = new Date(2024, 5, 14, 10, 0, 0).getTime();
    const sessions = [
      session({ id: "newer-day", createdAt: june15, text: "x" }),
      session({ id: "older-day", createdAt: june14, text: "y" }),
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups.map((g) => g.dateKey)).toEqual(["2024-06-15", "2024-06-14"]);
  });

  it("그룹 내 순서는 입력(전역 최신순) 순서를 유지한다", () => {
    const base = new Date(2024, 7, 1, 12, 0, 0).getTime();
    const t1 = base + 2000;
    const t0 = base + 1000;
    const sessions = [
      session({ id: "first", createdAt: t1, text: "1" }),
      session({ id: "second", createdAt: t0, text: "2" }),
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(["first", "second"]);
  });
});

describe("localDateKeyFromTimestamp", () => {
  it("로컬 자정 경계를 반영한다", () => {
    const ms = new Date(2024, 5, 15, 23, 59, 59).getTime();
    expect(localDateKeyFromTimestamp(ms)).toBe("2024-06-15");
  });
});

describe("previewSessionText", () => {
  it("앞뒤 공백을 제거한다", () => {
    expect(previewSessionText("  hello  ", 10)).toBe("hello");
  });

  it("길이 초과 시 접미 말줄임", () => {
    expect(previewSessionText("abcdefghij", 4)).toBe("abcd…");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(previewSessionText("   ", 5)).toBe("");
  });

  it("SESSION_LIST_PREVIEW_MAX 경계에서 말줄임", () => {
    const s = "가".repeat(SESSION_LIST_PREVIEW_MAX + 2);
    const out = previewSessionText(s, SESSION_LIST_PREVIEW_MAX);
    expect(out).toHaveLength(SESSION_LIST_PREVIEW_MAX + 1);
    expect(out.endsWith("…")).toBe(true);
  });
});
