/**
 * SQLite Schema 定義
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_DIR = path.join(DATA_DIR, "db");
const USERS_DB_DIR = path.join(DB_DIR, "users");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 初始化主資料庫 (用戶帳號)
 */
export function initMainDb(): Database.Database {
  ensureDir(DB_DIR);
  const dbPath = path.join(DB_DIR, "main.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      UNIQUE(provider, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
  `);

  return db;
}

/**
 * 初始化用戶資料庫 (對話)
 */
export function initUserDb(userId: string): Database.Database {
  ensureDir(USERS_DB_DIR);
  const dbPath = path.join(USERS_DB_DIR, `${userId}.db`);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT CHECK(role IN ('user', 'assistant')),
      content TEXT,
      citations JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  return db;
}

export function getUserDbPath(userId: string): string {
  return path.join(USERS_DB_DIR, `${userId}.db`);
}

export function userDbExists(userId: string): boolean {
  return fs.existsSync(getUserDbPath(userId));
}
