/**
 * 查詢入口
 *
 * 用法: pnpm run query "查詢文字"
 */

import "dotenv/config";
import { embed } from "./libs/embedder.js";
import { searchVectors, listAllVectorStores } from "./libs/vector-store.js";
import { log } from "./libs/utils.js";

async function main() {
  const queryText = process.argv.slice(2).join(" ");

  if (!queryText) {
    console.log("用法: pnpm run query <查詢文字>");
    process.exit(1);
  }

  log(`查詢: ${queryText}`);

  const queryVector = await embed(queryText);

  // 搜尋所有向量儲存
  const stores = listAllVectorStores();
  const allResults: Array<{
    store: string;
    score: number;
    content: string;
    metadata: Record<string, unknown>;
  }> = [];

  for (const store of stores) {
    const results = searchVectors(store, queryVector, 3);
    for (const result of results) {
      allResults.push({
        store,
        score: result.score,
        content: result.content,
        metadata: result.metadata,
      });
    }
  }

  // 按相似度排序
  allResults.sort((a, b) => b.score - a.score);

  console.log("\n=== 搜尋結果 ===\n");

  for (let i = 0; i < Math.min(5, allResults.length); i++) {
    const result = allResults[i];
    console.log(`[${i + 1}] 相似度: ${(result.score * 100).toFixed(2)}%`);
    console.log(`    來源: ${result.store} / ${result.metadata.source || ""}`);
    console.log(`    內容: ${result.content.substring(0, 200)}...`);
    console.log("");
  }

  if (allResults.length === 0) {
    console.log("沒有找到相關結果。請先執行 pnpm run sync 同步資料。");
  }
}

main().catch(console.error);
