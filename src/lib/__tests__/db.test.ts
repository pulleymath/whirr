import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAllSessions,
  getSessionById,
  saveSession,
  saveSessionAudio,
  saveSessionAudioSegment,
  getSessionAudio,
  updateSession,
} from "../db";
import type { SessionScriptMeta } from "../session-script-meta";
import { disconnectWhirrDb } from "../db";
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

  it("saveSession에 title을 넘기면 trim한 값이 저장된다", async () => {
    const id = await saveSession("hello", { title: "  주간 회의  " });
    const row = await getSessionById(id);
    expect(row?.title).toBe("주간 회의");
  });

  it("saveSession에 공백만 있는 title은 저장하지 않는다", async () => {
    const id = await saveSession("hello", { title: "   \t  " });
    const row = await getSessionById(id);
    expect(row?.title).toBeUndefined();
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
      template: { id: "default" as const },
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

  it("saveSessionAudio에 fullBlob을 넘기면 getSessionAudio에서 함께 조회한다", async () => {
    const sessionId = "session-full";
    const segments = [new Blob(["part1"], { type: "audio/webm" })];
    const fullBlob = new Blob(["full"], { type: "audio/webm" });

    await saveSessionAudio(sessionId, segments, fullBlob);
    const saved = await getSessionAudio(sessionId);

    expect(saved).toBeDefined();
    expect(saved!.segments).toHaveLength(1);
    expect(saved!.fullBlob).toBeDefined();
    expect(await saved!.fullBlob!.text()).toBe("full");
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

  it("saveSessionAudioSegment으로 누적 저장한 세그먼트를 index 순으로 조회한다", async () => {
    const sessionId = "session-seg";
    await saveSessionAudioSegment(
      sessionId,
      1,
      new Blob(["b"], { type: "audio/webm" }),
    );
    await saveSessionAudioSegment(
      sessionId,
      0,
      new Blob(["a"], { type: "audio/webm" }),
    );

    const saved = await getSessionAudio(sessionId);
    expect(saved?.segments).toHaveLength(2);
    expect(await saved!.segments[0].text()).toBe("a");
    expect(await saved!.segments[1].text()).toBe("b");
  });

  it("세그먼트 store가 비어 있으면 레거시 session-audio row를 읽는다", async () => {
    const sessionId = "legacy-only";
    await saveSession("t");
    const { openDB } = await import("idb");
    const conn = await openDB("whirr-db");
    await conn.put("session-audio", {
      sessionId,
      segments: [new Blob(["legacy"], { type: "audio/webm" })],
    });
    conn.close();
    await disconnectWhirrDb();

    const saved = await getSessionAudio(sessionId);
    expect(saved?.segments).toHaveLength(1);
    expect(await saved!.segments[0].text()).toBe("legacy");
  });
});
