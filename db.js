import Database from "better-sqlite3";

export const db = new Database("data.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS enterprises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager TEXT NOT NULL,
  discord TEXT,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('legal','illegal')),
  created_at INTEGER NOT NULL
);
`);
