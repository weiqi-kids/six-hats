/**
 * 資料庫連線管理
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import { initMainDb, initUserDb, initSixHatsDb, getUserDbPath } from "./schema.js";

let mainDb: Database.Database | null = null;
const userDbPool: Map<string, Database.Database> = new Map();

export function getMainDb(): Database.Database {
  if (!mainDb) {
    mainDb = initMainDb();
  }
  return mainDb;
}

export function getUserDb(userId: string): Database.Database {
  if (!userDbPool.has(userId)) {
    const db = initUserDb(userId);
    userDbPool.set(userId, db);
  }
  return userDbPool.get(userId)!;
}

export function closeAllConnections(): void {
  if (mainDb) {
    mainDb.close();
    mainDb = null;
  }
  for (const db of userDbPool.values()) {
    db.close();
  }
  userDbPool.clear();
}

// ==================== User ====================

export interface User {
  id: string;
  provider: string;
  provider_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

export function upsertUser(data: {
  provider: string;
  provider_id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
}): User {
  const db = getMainDb();
  const existing = db
    .prepare("SELECT * FROM users WHERE provider = ? AND provider_id = ?")
    .get(data.provider, data.provider_id) as User | undefined;

  if (existing) {
    db.prepare(
      `UPDATE users SET
        email = COALESCE(?, email),
        display_name = COALESCE(?, display_name),
        avatar_url = COALESCE(?, avatar_url),
        last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    ).run(data.email, data.display_name, data.avatar_url, existing.id);

    return db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id) as User;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, provider, provider_id, email, display_name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.provider, data.provider_id, data.email || null, data.display_name || null, data.avatar_url || null);

  initUserDb(id);

  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User;
}

export function getUser(userId: string): User | null {
  const db = getMainDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User | null;
}

// ==================== Conversation ====================

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function createConversation(userId: string, title?: string): Conversation {
  const db = getUserDb(userId);
  const id = uuidv4();
  db.prepare("INSERT INTO conversations (id, title) VALUES (?, ?)").run(id, title || null);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation;
}

export function getConversations(userId: string): Conversation[] {
  const db = getUserDb(userId);
  return db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all() as Conversation[];
}

export function getConversation(userId: string, conversationId: string): Conversation | null {
  const db = getUserDb(userId);
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationId) as Conversation | null;
}

export function deleteConversation(userId: string, conversationId: string): void {
  const db = getUserDb(userId);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
}

export function updateConversationTitle(userId: string, conversationId: string, title: string): void {
  const db = getUserDb(userId);
  db.prepare("UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, conversationId);
}

// ==================== Message ====================

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: string | null;
  created_at: string;
}

export interface Citation {
  chunkId: string;
  source: string;
  title: string;
  excerpt: string;
  url: string;
}

export function addMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  citations?: Citation[]
): Message {
  const db = getUserDb(userId);
  const id = uuidv4();
  const citationsJson = citations ? JSON.stringify(citations) : null;

  db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content, citations) VALUES (?, ?, ?, ?, ?)"
  ).run(id, conversationId, role, content, citationsJson);

  db.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conversationId);

  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
}

export function getMessages(userId: string, conversationId: string): Message[] {
  const db = getUserDb(userId);
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC")
    .all(conversationId) as Message[];
}

// ==================== Session Migration ====================

/**
 * 將匿名 session 的資料遷移到正式用戶帳號
 */
export function migrateSessionData(sessionId: string, userId: string): void {
  const sessionDbPath = getUserDbPath(sessionId);

  if (!fs.existsSync(sessionDbPath)) {
    return;
  }

  const sessionDb = new Database(sessionDbPath);
  const userDb = getUserDb(userId);

  // 確保 six-hats 表已初始化
  initSixHatsDb(userId);

  try {
    // 遷移 six_hats_sessions
    const sessions = sessionDb
      .prepare("SELECT * FROM six_hats_sessions")
      .all() as any[];

    for (const s of sessions) {
      userDb
        .prepare(
          `INSERT OR IGNORE INTO six_hats_sessions (id, topic, user_context, current_round, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(s.id, s.topic, s.user_context, s.current_round, s.status, s.created_at, s.updated_at);
    }

    // 遷移 six_hats_messages
    const messages = sessionDb
      .prepare("SELECT * FROM six_hats_messages")
      .all() as any[];

    for (const m of messages) {
      userDb
        .prepare(
          `INSERT OR IGNORE INTO six_hats_messages (id, session_id, round, phase, role, content, key_points, referenced_hats, tools_used, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(m.id, m.session_id, m.round, m.phase, m.role, m.content, m.key_points, m.referenced_hats, m.tools_used, m.created_at);
    }

    // 遷移 six_hats_evaluations
    const evaluations = sessionDb
      .prepare("SELECT * FROM six_hats_evaluations")
      .all() as any[];

    for (const e of evaluations) {
      userDb
        .prepare(
          `INSERT OR IGNORE INTO six_hats_evaluations (id, session_id, round, problem, cause, method, best_process, deliverable, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(e.id, e.session_id, e.round, e.problem, e.cause, e.method, e.best_process, e.deliverable, e.created_at);
    }

    // 遷移 user_attachments
    try {
      const attachments = sessionDb
        .prepare("SELECT * FROM user_attachments")
        .all() as any[];

      for (const a of attachments) {
        userDb
          .prepare(
            `INSERT OR IGNORE INTO user_attachments (id, filename, original_name, content_type, source_type, source_url, chunk_count, enabled, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(a.id, a.filename, a.original_name, a.content_type, a.source_type, a.source_url, a.chunk_count, a.enabled, a.status, a.created_at, a.updated_at);
      }
    } catch {
      // user_attachments 表可能不存在
    }

    // 關閉並刪除 session 資料庫
    sessionDb.close();
    userDbPool.delete(sessionId);
    fs.unlinkSync(sessionDbPath);

    console.log(`Migrated session data from ${sessionId} to ${userId}`);
  } catch (error) {
    sessionDb.close();
    console.error("Migration error:", error);
  }
}
