/**
 * 資料庫連線管理
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { initMainDb, initUserDb } from "./schema.js";

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
