/**
 * RAG 服務
 *
 * 整合現有的向量搜尋功能
 */

import { embed } from "../../crawlers/libs/embedder.js";
import {
  searchVectors,
  listAllVectorStores,
  type VectorEntry,
} from "../../crawlers/libs/vector-store.js";
import type { Citation } from "../db/index.js";

export interface SearchResult {
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

// 動態閾值設定（由高到低嘗試，黃金比例）
const THRESHOLD_LEVELS = [0.89, 0.55, 0.34, 0.21];

// 絕對最低門檻 - 低於此分數視為完全無相關
const ABSOLUTE_MIN_THRESHOLD = 0.21;

// 最少需要的結果數
const MIN_RESULTS = 2;

/**
 * 語意搜尋（動態閾值）
 *
 * 策略：從高閾值開始，如果結果不足，自動降低閾值重試
 */
export async function semanticSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // 取得查詢向量
  const queryVector = await embed(query);

  // 搜尋所有向量儲存
  const allStores = listAllVectorStores();
  const allResults: Array<VectorEntry & { score: number }> = [];

  for (const store of allStores) {
    const results = searchVectors(store, queryVector, topK * 3); // 多搜一些供過濾
    allResults.push(...results);
  }

  // 按分數排序
  allResults.sort((a, b) => b.score - a.score);

  // 動態調整閾值：從高到低嘗試，直到有足夠結果
  let filtered: Array<VectorEntry & { score: number }> = [];
  let usedThreshold = THRESHOLD_LEVELS[0];

  for (const threshold of THRESHOLD_LEVELS) {
    filtered = allResults.filter((r) => r.score >= threshold).slice(0, topK);
    usedThreshold = threshold;

    if (filtered.length >= MIN_RESULTS) {
      break; // 結果足夠，停止降低閾值
    }
  }

  // 如果所有閾值都試過還是不夠，取最相關的幾筆（只要高於絕對最低門檻）
  if (filtered.length < MIN_RESULTS && allResults.length > 0) {
    filtered = allResults
      .filter((r) => r.score >= ABSOLUTE_MIN_THRESHOLD)
      .slice(0, topK);
  }

  // 記錄使用的閾值（供調試）
  if (filtered.length > 0) {
    console.log(`[RAG] 搜尋完成: ${filtered.length} 筆結果, 閾值=${usedThreshold}, 最高分=${(filtered[0].score * 100).toFixed(1)}%`);
  } else {
    console.log(`[RAG] 搜尋無結果: 最高分=${allResults.length > 0 ? (allResults[0].score * 100).toFixed(1) + '%' : 'N/A'}`);
  }

  return filtered.map((r) => ({
    score: r.score,
    content: r.content,
    metadata: r.metadata,
  }));
}

/**
 * 搜尋結果含分數資訊
 */
export interface SearchResultWithScore {
  citations: Citation[];
  maxScore: number;
  resultCount: number;
}

/**
 * 搜尋並轉換為 Citation 格式
 */
export async function searchForCitations(
  query: string,
  topK: number = 5
): Promise<Citation[]> {
  const result = await searchForCitationsWithScore(query, topK);
  return result.citations;
}

/**
 * 搜尋並返回 Citation 格式及分數資訊
 */
export async function searchForCitationsWithScore(
  query: string,
  topK: number = 5
): Promise<SearchResultWithScore> {
  const results = await semanticSearch(query, topK);
  const maxScore = results.length > 0 ? results[0].score : 0;

  const citations = results.map((r) => ({
    chunkId: r.metadata.id as string || "",
    source: r.metadata.source as string || "",
    title: buildTitle(r.metadata),
    excerpt: r.content.substring(0, 200) + "...",
    url: buildUrl(r.metadata),
    lastModified: r.metadata.lastModified as string || "",
    fetchedAt: r.metadata.fetchedAt as string || "",
  }));

  return {
    citations,
    maxScore,
    resultCount: results.length,
  };
}

/**
 * 根據 metadata 建立 URL
 * TODO: 根據知識庫的資料來源格式調整
 */
function buildUrl(metadata: Record<string, unknown>): string {
  // 如果已有 URL，直接使用
  if (metadata.url) {
    return metadata.url as string;
  }

  // TODO: 根據不同來源建立 URL
  // 例如：
  // const source = metadata.source as string;
  // switch (source) {
  //   case "example-source":
  //     return `https://example.com/${metadata.id}`;
  // }

  return "";
}

/**
 * 根據 metadata 建立標題
 * TODO: 根據知識庫的資料來源格式調整
 */
function buildTitle(metadata: Record<string, unknown>): string {
  // 優先使用 title
  if (metadata.title) {
    return metadata.title as string;
  }

  // TODO: 根據不同來源建立標題
  // 例如：
  // const source = metadata.source as string;
  // switch (source) {
  //   case "example-source":
  //     return `${metadata.category} - ${metadata.name}`;
  // }

  return metadata.source as string || "Unknown";
}

/**
 * 搜尋全域向量 + 用戶個人向量
 * 用於 six-hats 分析時注入個人知識
 */
export async function semanticSearchWithUserVectors(
  query: string,
  userId: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryVector = await embed(query);

  const allStores = listAllVectorStores();
  const allResults: Array<VectorEntry & { score: number }> = [];

  for (const store of allStores) {
    const results = searchVectors(store, queryVector, topK * 3);
    allResults.push(...results);
  }

  // 搜尋用戶個人向量（如果存在）
  const userStoreName = `user-${userId}`;
  if (!allStores.includes(userStoreName)) {
    // 嘗試搜尋（可能不存在，searchVectors 會回傳空陣列）
    const userResults = searchVectors(userStoreName, queryVector, topK * 3);
    allResults.push(...userResults);
  }

  allResults.sort((a, b) => b.score - a.score);

  // 動態調整閾值
  let filtered: Array<VectorEntry & { score: number }> = [];
  let usedThreshold = THRESHOLD_LEVELS[0];

  for (const threshold of THRESHOLD_LEVELS) {
    filtered = allResults.filter((r) => r.score >= threshold).slice(0, topK);
    usedThreshold = threshold;

    if (filtered.length >= MIN_RESULTS) {
      break;
    }
  }

  if (filtered.length < MIN_RESULTS && allResults.length > 0) {
    filtered = allResults
      .filter((r) => r.score >= ABSOLUTE_MIN_THRESHOLD)
      .slice(0, topK);
  }

  return filtered.map((r) => ({
    score: r.score,
    content: r.content,
    metadata: r.metadata,
  }));
}

/**
 * 建立 RAG 上下文
 */
export async function buildContext(query: string, topK: number = 5): Promise<string> {
  const results = await semanticSearch(query, topK);

  if (results.length === 0) {
    return "（未找到相關資料）";
  }

  const context = results
    .map((r, i) => {
      const title = buildTitle(r.metadata);
      return `【來源 ${i + 1}】${title}\n${r.content}`;
    })
    .join("\n\n---\n\n");

  return context;
}
