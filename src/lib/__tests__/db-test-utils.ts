import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { disconnectWhirrDb } from "../db";

const WHIRR_DB_NAME = "whirr-db";

export async function resetWhirrDbForTests(): Promise<void> {
  await disconnectWhirrDb();
  await deleteDB(WHIRR_DB_NAME).catch(() => undefined);
}
