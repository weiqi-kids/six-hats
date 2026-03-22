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

// 相關性閾值 - 低於此分數的結果不顯示
const RELEVANCE_THRESHOLD = 0.70;

// 最低門檻 - 低於此分數視為無相關資料
const MIN_THRESHOLD = 0.50;

/**
 * 語意搜尋
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
    const results = searchVectors(store, queryVector, topK * 2); // 多搜一些再過濾
    allResults.push(...results);
  }

  // 按分數排序
  allResults.sort((a, b) => b.score - a.score);

  // 過濾低相關性結果，並取前 K 個
  let filtered = allResults
    .filter((r) => r.score >= RELEVANCE_THRESHOLD)
    .slice(0, topK);

  // 如果過濾後沒有結果，且最相關的一筆分數高於最低門檻，才保留
  if (filtered.length === 0 && allResults.length > 0 && allResults[0].score >= MIN_THRESHOLD) {
    filtered.push(allResults[0]);
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
