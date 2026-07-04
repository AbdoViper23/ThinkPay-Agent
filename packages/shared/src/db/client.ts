// Drizzle DB client (docs/05). NODE-ONLY — never import from the browser barrel.
// Reused by memory/ledger (Phase 2+) and the seed script.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

// thinkpay.db lives at the repo root (matches drizzle.config.ts `url: "./thinkpay.db"`),
// resolved relative to this file so it works regardless of cwd.
const DB_PATH = fileURLToPath(new URL("../../../../thinkpay.db", import.meta.url));

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };
export * from "./schema";
