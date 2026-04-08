import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Session = {
  id: string;
  createdAt: number;
  text: string;
};

interface WhirrDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
    indexes: { "by-createdAt": number };
  };
}

const DB_NAME = "whirr-db";
const STORE = "sessions";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WhirrDB>> | null = null;

function getDb(): Promise<IDBPDatabase<WhirrDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WhirrDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
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

export async function saveSession(text: string): Promise<string> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const db = await getDb();
  await db.put(STORE, { id, createdAt, text });
  return id;
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
