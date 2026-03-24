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

/**
 * 初始化六帽思考資料庫 (per-user)
 */
export function initSixHatsDb(userId: string): Database.Database {
  ensureDir(USERS_DB_DIR);
  const dbPath = path.join(USERS_DB_DIR, `${userId}.db`);
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS six_hats_sessions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      user_context TEXT DEFAULT '{}',
      current_round INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS six_hats_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES six_hats_sessions(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      phase TEXT,
      role TEXT NOT NULL,
      content TEXT,
      key_points JSON DEFAULT '[]',
      referenced_hats JSON DEFAULT '[]',
      tools_used JSON DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_six_hats_messages_session ON six_hats_messages(session_id);

    CREATE TABLE IF NOT EXISTS six_hats_evaluations (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES six_hats_sessions(id) ON DELETE CASCADE,
      round INTEGER NOT NULL,
      problem JSON,
      cause JSON,
      method JSON,
      best_process JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_six_hats_evaluations_session ON six_hats_evaluations(session_id);
  `);

  // Migration: 加入 deliverable 欄位
  try {
    db.exec("ALTER TABLE six_hats_evaluations ADD COLUMN deliverable TEXT");
  } catch {
    // 欄位已存在，忽略
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_attachments (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT,
      content_type TEXT,
      source_type TEXT CHECK(source_type IN ('file', 'url', 'text')),
      source_url TEXT,
      chunk_count INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'processing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export function getUserDbPath(userId: string): string {
  return path.join(USERS_DB_DIR, `${userId}.db`);
}

export function userDbExists(userId: string): boolean {
  return fs.existsSync(getUserDbPath(userId));
}
