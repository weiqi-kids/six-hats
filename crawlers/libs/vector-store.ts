/**
 * 向量儲存模組 (JSON 檔案)
 */

import * as fs from "fs";
import * as path from "path";
import type { Chunk } from "./chunker.js";

export interface VectorEntry {
  id: string;
  content: string;
  contentHash: string;  // 內容雜湊，用於變更偵測
  vector: number[];
  metadata: Chunk["metadata"];
  hidden?: boolean;     // 隱藏標記，不會出現在搜尋結果
}

export interface VectorStore {
  version: string;
  updatedAt: string;
  entries: VectorEntry[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const VECTORS_DIR = path.join(DATA_DIR, "vectors");
const DELETED_DIR = path.join(DATA_DIR, "deleted");
const DELETED_VECTORS_DIR = path.join(DELETED_DIR, "vectors");

/**
 * 確保目錄存在
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 載入向量儲存
 */
export function loadVectorStore(name: string): VectorStore {
  ensureDir(VECTORS_DIR);
  const filePath = path.join(VECTORS_DIR, `${name}.json`);

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }

  return {
    version: "1.0",
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

/**
 * 儲存向量儲存
 */
export function saveVectorStore(name: string, store: VectorStore): void {
  ensureDir(VECTORS_DIR);
  const filePath = path.join(VECTORS_DIR, `${name}.json`);

  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));
}

/**
 * 新增或更新向量
 */
export function upsertVectors(
  name: string,
  entries: VectorEntry[]
): void {
  const store = loadVectorStore(name);

  for (const entry of entries) {
    const existingIndex = store.entries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      store.entries[existingIndex] = entry;
    } else {
      store.entries.push(entry);
    }
  }

  saveVectorStore(name, store);
}

/**
 * 計算餘弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 搜尋相似向量
 */
export function searchVectors(
  name: string,
  queryVector: number[],
  topK: number = 5
): Array<VectorEntry & { score: number }> {
  const store = loadVectorStore(name);

  const scored = store.entries
    .filter((entry) => !entry.hidden)  // 過濾隱藏向量
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(queryVector, entry.vector),
    }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * 清空向量儲存
 */
export function clearVectorStore(name: string): void {
  const store: VectorStore = {
    version: "1.0",
    updatedAt: new Date().toISOString(),
    entries: [],
  };
  saveVectorStore(name, store);
}

/**
 * 取得統計資訊
 */
export function getStats(name: string): { count: number; updatedAt: string } {
  const store = loadVectorStore(name);
  return {
    count: store.entries.length,
    updatedAt: store.updatedAt,
  };
}

/**
 * 列出所有向量儲存
 */
export function listAllVectorStores(): string[] {
  ensureDir(VECTORS_DIR);
  return fs
    .readdirSync(VECTORS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/**
 * 計算內容雜湊 (簡易版，用於變更偵測)
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * 取得現有的內容雜湊對照表
 * 回傳 Map<id, contentHash>
 */
export function getExistingHashes(name: string): Map<string, string> {
  const store = loadVectorStore(name);
  const hashMap = new Map<string, string>();

  for (const entry of store.entries) {
    if (entry.contentHash) {
      hashMap.set(entry.id, entry.contentHash);
    }
  }

  return hashMap;
}

/**
 * 刪除指定上傳 ID 的向量
 * 回傳刪除的數量
 */
export function deleteVectorsByUploadId(name: string, uploadId: string): number {
  const store = loadVectorStore(name);
  const originalCount = store.entries.length;

  store.entries = store.entries.filter(
    (entry) => entry.metadata.uploadId !== uploadId
  );

  saveVectorStore(name, store);
  return originalCount - store.entries.length;
}

/**
 * 設定指定上傳 ID 的向量隱藏狀態
 * 回傳更新的數量
 */
export function setVectorsHiddenByUploadId(name: string, uploadId: string, hidden: boolean): number {
  const store = loadVectorStore(name);
  let count = 0;

  for (const entry of store.entries) {
    if (entry.metadata.uploadId === uploadId) {
      entry.hidden = hidden;
      count++;
    }
  }

  if (count > 0) {
    saveVectorStore(name, store);
  }

  return count;
}

/**
 * 設定指定 ID 的向量隱藏狀態（單一向量或 ID 前綴匹配）
 * 回傳更新的數量
 */
export function setVectorsHiddenById(name: string, idPrefix: string, hidden: boolean): number {
  const store = loadVectorStore(name);
  let count = 0;

  for (const entry of store.entries) {
    if (entry.id === idPrefix || entry.id.startsWith(idPrefix + "-")) {
      entry.hidden = hidden;
      count++;
    }
  }

  if (count > 0) {
    saveVectorStore(name, store);
  }

  return count;
}

/**
 * 刪除指定 ID 前綴的向量
 * 回傳刪除的數量
 */
export function deleteVectorsById(name: string, idPrefix: string): number {
  const store = loadVectorStore(name);
  const originalCount = store.entries.length;

  store.entries = store.entries.filter(
    (entry) => entry.id !== idPrefix && !entry.id.startsWith(idPrefix + "-")
  );

  saveVectorStore(name, store);
  return originalCount - store.entries.length;
}

/**
 * 移動指定上傳 ID 的向量到 deleted 資料夾
 * 回傳移動的數量
 */
export function moveVectorsToDeletedByUploadId(name: string, uploadId: string): number {
  const store = loadVectorStore(name);

  // 找出要刪除的向量
  const toDelete = store.entries.filter(
    (entry) => entry.metadata.uploadId === uploadId
  );

  if (toDelete.length === 0) return 0;

  // 移除這些向量
  store.entries = store.entries.filter(
    (entry) => entry.metadata.uploadId !== uploadId
  );

  // 儲存到 deleted 資料夾
  ensureDir(DELETED_VECTORS_DIR);
  const deletedFilePath = path.join(DELETED_VECTORS_DIR, `${name}-${uploadId}-${Date.now()}.json`);
  fs.writeFileSync(deletedFilePath, JSON.stringify({
    deletedAt: new Date().toISOString(),
    source: name,
    uploadId,
    entries: toDelete,
  }, null, 2));

  saveVectorStore(name, store);
  return toDelete.length;
}

/**
 * 移動指定 ID 前綴的向量到 deleted 資料夾
 * 回傳移動的數量
 */
export function moveVectorsToDeletedById(name: string, idPrefix: string): number {
  const store = loadVectorStore(name);

  // 找出要刪除的向量
  const toDelete = store.entries.filter(
    (entry) => entry.id === idPrefix || entry.id.startsWith(idPrefix + "-")
  );

  if (toDelete.length === 0) return 0;

  // 移除這些向量
  store.entries = store.entries.filter(
    (entry) => entry.id !== idPrefix && !entry.id.startsWith(idPrefix + "-")
  );

  // 儲存到 deleted 資料夾
  ensureDir(DELETED_VECTORS_DIR);
  const deletedFilePath = path.join(DELETED_VECTORS_DIR, `${name}-${idPrefix.replace(/[^a-zA-Z0-9-]/g, '_')}-${Date.now()}.json`);
  fs.writeFileSync(deletedFilePath, JSON.stringify({
    deletedAt: new Date().toISOString(),
    source: name,
    idPrefix,
    entries: toDelete,
  }, null, 2));

  saveVectorStore(name, store);
  return toDelete.length;
}
