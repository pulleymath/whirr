import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAllSessions,
  getSessionById,
  saveSession,
  saveSessionAudio,
  getSessionAudio,
  updateSession,
} from "../db";
import type { SessionScriptMeta } from "../session-script-meta";
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

  it("saveSession에 status를 넘기면 저장된 세션에 반영된다", async () => {
    const id = await saveSession("partial", { status: "transcribing" });
    const row = await getSessionById(id);
    expect(row?.status).toBe("transcribing");
  });

  it("saveSession에 status를 생략하면 ready가 된다", async () => {
    const id = await saveSession("done text");
    const row = await getSessionById(id);
    expect(row?.status).toBe("ready");
  });

  it("updateSession으로 text·summary·status를 갱신할 수 있다", async () => {
    const id = await saveSession("a", { status: "transcribing" });
    await updateSession(id, { text: "b", status: "summarizing" });
    await updateSession(id, { summary: "요약", status: "ready" });
    const row = await getSessionById(id);
    expect(row?.text).toBe("b");
    expect(row?.summary).toBe("요약");
    expect(row?.status).toBe("ready");
  });

  it("Session에 context 필드 없이 저장·조회해도 정상 동작한다", async () => {
    const id = await saveSession("ctx-less");
    const row = await getSessionById(id);
    expect(row?.context).toBeUndefined();
  });

  it("SessionUpdate에 context를 포함하여 updateSession하면 저장된다", async () => {
    const id = await saveSession("a", { status: "transcribing" });
    const ctx = {
      glossary: ["Whirr"],
      sessionContext: {
        participants: "팀",
        topic: "스프린트",
        keywords: "배포",
      },
    };
    await updateSession(id, { context: ctx });
    const row = await getSessionById(id);
    expect(row?.context).toEqual(ctx);
  });

  it("존재하지 않는 id로 updateSession하면 에러를 던진다", async () => {
    await expect(updateSession("missing-id", { text: "x" })).rejects.toThrow(
      /Session not found/,
    );
  });

  it("saveSession에 scriptMeta를 넘기면 조회 시 반영된다", async () => {
    const meta: SessionScriptMeta = {
      mode: "batch",
      batchModel: "whisper-1",
      language: "ko",
      minutesModel: "gpt-4o-mini",
    };
    const id = await saveSession("t", { status: "ready", scriptMeta: meta });
    const row = await getSessionById(id);
    expect(row?.scriptMeta).toEqual(meta);
  });

  it("updateSession으로 scriptMeta를 갱신할 수 있다", async () => {
    const id = await saveSession("a");
    const meta: SessionScriptMeta = {
      mode: "realtime",
      engine: "openai",
      language: "en",
      minutesModel: "gpt-4o",
    };
    await updateSession(id, { scriptMeta: meta });
    const row = await getSessionById(id);
    expect(row?.scriptMeta).toEqual(meta);
  });

  it("saveSessionAudio 및 getSessionAudio가 정상 동작한다", async () => {
    const sessionId = "session-123";
    const segments = [
      new Blob(["part1"], { type: "audio/webm" }),
      new Blob(["part2"], { type: "audio/webm" }),
    ];

    await saveSessionAudio(sessionId, segments);
    const saved = await getSessionAudio(sessionId);

    expect(saved).toBeDefined();
    expect(saved!.sessionId).toBe(sessionId);
    expect(saved!.segments).toHaveLength(2);
    expect(await saved!.segments[0].text()).toBe("part1");
  });
});
