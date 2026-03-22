/**
 * 狀態入口
 *
 * 用法: pnpm run status
 */

import "dotenv/config";
import { listRawFiles, listChunkFiles } from "./libs/utils.js";
import { getStats, listAllVectorStores } from "./libs/vector-store.js";
import { loadAllLatestReports, getReportSummary } from "./libs/reporter.js";

function main() {
  const rawFiles = listRawFiles();
  const chunkFiles = listChunkFiles();
  const stores = listAllVectorStores();

  console.log("\n=== six-hats 知識庫狀態 ===\n");
  console.log(`原始資料: ${rawFiles.length} 個檔案`);
  if (rawFiles.length > 0) {
    console.log(`          ${rawFiles.join(", ")}`);
  }
  console.log(`Chunks:   ${chunkFiles.length} 個檔案`);
  console.log("");

  if (stores.length === 0) {
    console.log("尚無向量資料。請執行 pnpm run sync 同步資料。");
  } else {
    console.log("向量儲存:");
    for (const store of stores) {
      const stats = getStats(store);
      console.log(`  - ${store}: ${stats.count} 筆 (更新: ${stats.updatedAt})`);
    }
  }

  // 顯示最新報告摘要
  const reports = loadAllLatestReports();
  if (reports.crawl) {
    console.log(getReportSummary(reports.crawl));
  }
  if (reports.process) {
    console.log(getReportSummary(reports.process));
  }
}

main();
