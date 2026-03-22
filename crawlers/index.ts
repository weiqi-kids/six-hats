/**
 * six-hats 知識庫主程式
 *
 * 用法:
 *   pnpm run sync     - 同步資料
 *   pnpm run query    - 查詢測試
 *   pnpm run rebuild  - 重建知識庫
 *   pnpm run status   - 顯示狀態
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { embed } from "./libs/embedder.js";
import {
  searchVectors,
  clearVectorStore,
  getStats,
} from "./libs/vector-store.js";
import { log, listRawFiles, listChunkFiles } from "./libs/utils.js";

const STORE_NAME = "six-hats";

/**
 * 同步資料
 */
async function sync(): Promise<void> {
  log("開始同步...");

  // TODO: 實作各個 crawler
  // 1. 執行各個 crawler 抓取資料
  // 2. 處理並切分
  // 3. Embedding
  // 4. 儲存向量

  log("同步完成");
}

/**
 * 查詢測試
 */
async function query(queryText: string): Promise<void> {
  log(`查詢: ${queryText}`);

  const queryVector = await embed(queryText);
  const results = searchVectors(STORE_NAME, queryVector, 5);

  console.log("\n=== 搜尋結果 ===\n");

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`[${i + 1}] 相似度: ${(result.score * 100).toFixed(2)}%`);
    console.log(`    來源: ${result.metadata.source}`);
    console.log(`    內容: ${result.content.substring(0, 200)}...`);
    console.log("");
  }
}

/**
 * 重建知識庫
 */
async function rebuild(): Promise<void> {
  log("開始重建知識庫...");

  // 清空向量儲存
  clearVectorStore(STORE_NAME);
  log("已清空向量儲存");

  // 重新執行同步
  await sync();

  log("重建完成");
}

/**
 * 顯示狀態
 */
function status(): void {
  const stats = getStats(STORE_NAME);
  const rawFiles = listRawFiles();
  const chunkFiles = listChunkFiles();

  console.log("\n=== six-hats 知識庫狀態 ===\n");
  console.log(`原始資料: ${rawFiles.length} 個檔案`);
  console.log(`Chunks:   ${chunkFiles.length} 個檔案`);
  console.log(`向量數:   ${stats.count}`);
  console.log(`最後更新: ${stats.updatedAt}`);
  console.log("");
}

// 主程式
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "sync":
    sync().catch(console.error);
    break;
  case "query":
    if (!args[0]) {
      console.log("用法: pnpm run query <查詢文字>");
      process.exit(1);
    }
    query(args.join(" ")).catch(console.error);
    break;
  case "rebuild":
    rebuild().catch(console.error);
    break;
  case "status":
    status();
    break;
  default:
    console.log("用法: pnpm run <sync|query|rebuild|status>");
    process.exit(1);
}
