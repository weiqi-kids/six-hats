/**
 * 通用處理模組
 *
 * 從 raw 資料處理成 chunks 和 vectors
 */

import { chunkText, type Chunk } from "./chunker.js";
import { embedBatch } from "./embedder.js";
import {
  upsertVectors,
  getExistingHashes,
  hashContent,
  type VectorEntry,
} from "./vector-store.js";
import { loadRawData, saveChunks, log } from "./utils.js";
import { createSourceResult, type SourceResult } from "./reporter.js";

/**
 * 處理項目 (已展開的單一項目)
 */
export interface ProcessItem {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * 資料來源定義
 */
export interface SourceDefinition {
  name: string;
  displayName: string;
  /**
   * 將 raw 資料展開成可處理的項目列表
   * 例如：一個法規包含多條條文，需要展開成多個 ProcessItem
   */
  expandRawData: (rawData: unknown) => ProcessItem[];
}

/**
 * 處理單一來源的 raw 資料
 */
export async function processSource(
  source: SourceDefinition
): Promise<SourceResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let rawCount = 0;
  let chunkCount = 0;
  let vectorCount = 0;

  log(`處理: ${source.displayName}`);

  try {
    // 讀取 raw 資料
    const rawData = loadRawData<unknown>(source.name);

    if (!rawData) {
      errors.push("無 raw 資料");
      log(`  跳過: 無 raw 資料`);
      return createSourceResult(source.name, {
        rawCount: 0,
        chunkCount: 0,
        vectorCount: 0,
        errors,
        duration: Date.now() - startTime,
      });
    }

    // 展開成處理項目
    const items = source.expandRawData(rawData);
    log(`  展開為 ${items.length} 個處理項目`);

    rawCount = items.length;

    if (items.length === 0) {
      errors.push("展開後無資料");
      return createSourceResult(source.name, {
        rawCount: 0,
        chunkCount: 0,
        vectorCount: 0,
        errors,
        duration: Date.now() - startTime,
      });
    }

    // 取得現有的內容雜湊
    const existingHashes = getExistingHashes(source.name);

    // 切分成 chunks 並計算雜湊
    const allChunks: Array<Chunk & { hash: string }> = [];

    for (const item of items) {
      const chunks = chunkText(item.content, item.id);

      for (const chunk of chunks) {
        Object.assign(chunk.metadata, item.metadata);
        allChunks.push({
          ...chunk,
          hash: hashContent(chunk.content),
        });
      }
    }

    chunkCount = allChunks.length;
    saveChunks(source.name, allChunks);
    log(`  產生 ${chunkCount} 個 chunks`);

    // 篩選需要重新 embedding 的 chunks（雜湊不同或不存在）
    const changedChunks = allChunks.filter((chunk) => {
      const existingHash = existingHashes.get(chunk.id);
      return existingHash !== chunk.hash;
    });

    const unchangedCount = allChunks.length - changedChunks.length;
    if (unchangedCount > 0) {
      log(`  跳過 ${unchangedCount} 個未變更的 chunks`);
    }

    // Embedding（只處理變更的）
    if (changedChunks.length > 0) {
      log(`  Embedding ${changedChunks.length} 個變更的 chunks...`);
      const texts = changedChunks.map((c) => c.content);
      const vectors = await embedBatch(texts);

      const entries: VectorEntry[] = changedChunks.map((chunk, i) => ({
        id: chunk.id,
        content: chunk.content,
        contentHash: chunk.hash,
        vector: vectors[i],
        metadata: chunk.metadata,
      }));

      upsertVectors(source.name, entries);
      vectorCount = entries.length;
      log(`  儲存 ${vectorCount} 個向量`);
    } else {
      log(`  所有 chunks 皆未變更，跳過 Embedding`);
    }
  } catch (error) {
    errors.push(String(error));
    log(`  錯誤: ${error}`);
  }

  return createSourceResult(source.name, {
    rawCount,
    chunkCount,
    vectorCount,
    errors,
    duration: Date.now() - startTime,
  });
}

/**
 * 處理所有來源
 */
export async function processAllSources(
  sources: SourceDefinition[]
): Promise<SourceResult[]> {
  const results: SourceResult[] = [];

  for (const source of sources) {
    const result = await processSource(source);
    results.push(result);
  }

  return results;
}
