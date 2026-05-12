import type { MeetingContext } from "@/lib/glossary/types";
import type { SessionScriptMeta } from "@/lib/session-script-meta";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type SessionStatus = "transcribing" | "summarizing" | "ready" | "error";

export type Session = {
  id: string;
  createdAt: number;
  text: string;
  /** 사용자가 입력한 노트 제목(선택, 레거시 세션은 생략 가능) */
  title?: string;
  /** 요약(저장 필드명 `summary`) 완료 후 채워짐 */
  summary?: string | null;
  /** 파이프라인·저장 상태 (구 레코드는 생략 가능 → ready로 간주) */
  status?: SessionStatus;
  /** 요약 생성 시 사용한 용어·세션 컨텍스트(선택) */
  context?: MeetingContext;
  /** 녹음·파이프라인 생성 시점 스크립트·요약 모델 메타(레거시 생략 가능) */
  scriptMeta?: SessionScriptMeta;
};

export type SaveSessionOptions = {
  status?: SessionStatus;
  scriptMeta?: SessionScriptMeta;
  /** 비어 있지 않을 때만 trim 후 저장한다 */
  title?: string;
  /** 요약 컨텍스트(용어·세션 정보·템플릿) — 선택 */
  context?: MeetingContext;
};

export type SessionAudio = {
  sessionId: string;
  segments: Blob[];
};

interface WhirrDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { "by-createdAt": number };
  };
  "session-audio": {
    key: string;
    value: SessionAudio;
  };
}

const DB_NAME = "whirr-db";
const STORE = "sessions";
const AUDIO_STORE = "session-audio";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<WhirrDB>> | null = null;

function getDb(): Promise<IDBPDatabase<WhirrDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WhirrDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
        }
        if (oldVersion < 2) {
          db.createObjectStore(AUDIO_STORE, { keyPath: "sessionId" });
        }
        if (oldVersion < 3) {
          /* Session.scriptMeta 필드 추가 — 스토어 스키마 변경 없음 */
        }
      },
    });
  }
  return dbPromise;
}

/** 열린 연결을 닫고 캐시된 `Promise`를 비운다. 테스트 유틸에서 `deleteDB` 전에 호출한다. */
export async function disconnectWhirrDb(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      /* ignore */
    }
    dbPromise = null;
  }
}

export async function saveSession(
  text: string,
  options?: SaveSessionOptions,
): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status: SessionStatus = options?.status ?? "ready";
  const trimmedTitle = options?.title?.trim();
  const db = await getDb();
  const row: Session = {
    id,
    createdAt,
    text,
    status,
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    ...(options?.scriptMeta ? { scriptMeta: options.scriptMeta } : {}),
    ...(options?.context ? { context: options.context } : {}),
  };
  await db.put(STORE, row);
  return id;
}

/** 텍스트·컨텍스트·메타를 한 번에 넣은 새 세션을 만든다. 내부적으로 `saveSession`과 동일. */
export async function createSessionWithContext(
  text: string,
  options?: SaveSessionOptions,
): Promise<string> {
  return saveSession(text, options);
}

export type SessionUpdate = Partial<
  Pick<
    Session,
    "text" | "summary" | "status" | "context" | "scriptMeta" | "title"
  >
>;

export async function updateSession(
  id: string,
  updates: SessionUpdate,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get(STORE, id);
  if (!existing) {
    throw new Error(`Session not found: ${id}`);
  }
  await db.put(STORE, { ...existing, ...updates });
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  const db = await getDb();
  return db.get(STORE, id);
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex(STORE, "by-createdAt");
  return [...rows].sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveSessionAudio(
  sessionId: string,
  segments: Blob[],
): Promise<void> {
  const db = await getDb();
  await db.put(AUDIO_STORE, { sessionId, segments });
}

export async function getSessionAudio(
  sessionId: string,
): Promise<SessionAudio | undefined> {
  const db = await getDb();
  return db.get(AUDIO_STORE, sessionId);
}
