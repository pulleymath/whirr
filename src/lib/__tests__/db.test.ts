import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllSessions, getSessionById, saveSession } from "../db";
import { resetWhirrDbForTests } from "./db-test-utils";

describe("db (IndexedDB)", () => {
  beforeEach(async () => {
    await resetWhirrDbForTests();
    vi.stubGlobal("crypto", {
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    });
  });

  afterEach(async () => {
    await resetWhirrDbForTests();
    vi.unstubAllGlobals();
  });

  it("saveSession 후 반환 id와 getSessionById로 조회한 레코드가 일치한다", async () => {
    const id = await saveSession("hello session");
    expect(id).toBe("00000000-0000-4000-8000-000000000001");

    const row = await getSessionById(id);
    expect(row).toBeDefined();
    expect(row!.id).toBe(id);
    expect(row!.text).toBe("hello session");
    expect(typeof row!.createdAt).toBe("number");
  });

  it("getAllSessions는 createdAt 기준 최신이 먼저 온다", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
        .mockReturnValueOnce("22222222-2222-4222-8222-222222222222"),
    });

    const t0 = 1_700_000_000_000;
    const t1 = 1_800_000_000_000;
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t1);

    await saveSession("older");
    await saveSession("newer");

    const all = await getAllSessions();
    expect(all).toHaveLength(2);
    expect(all[0]!.text).toBe("newer");
    expect(all[1]!.text).toBe("older");

    nowSpy.mockRestore();
  });
});
