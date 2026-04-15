import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type SessionStatus = "transcribing" | "summarizing" | "ready" | "error";

export type Session = {
  id: string;
  createdAt: number;
  text: string;
  /** 요약 완료 후 채워짐 */
  summary?: string | null;
  /** 파이프라인·저장 상태 (구 레코드는 생략 가능 → ready로 간주) */
  status?: SessionStatus;
};

export type SaveSessionOptions = {
  status?: SessionStatus;
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
const DB_VERSION = 2;

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
  const db = await getDb();
  await db.put(STORE, { id, createdAt, text, status });
  return id;
}

export type SessionUpdate = Partial<
  Pick<Session, "text" | "summary" | "status">
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
