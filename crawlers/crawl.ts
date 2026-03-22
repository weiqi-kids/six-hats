/**
 * 抓取入口
 *
 * 用法: pnpm run crawl
 *
 * TODO: 根據 sources.yaml 配置，實作各個資料來源的爬蟲
 */

import "dotenv/config";
import { log } from "./libs/utils.js";
import { createReport, finalizeReport, saveReport, type SourceResult } from "./libs/reporter.js";

// TODO: 導入各個來源的爬蟲
// import { crawlExample } from "./sources/example.js";

async function main() {
  log("開始抓取資料...");

  const report = createReport();
  const results: SourceResult[] = [];

  // TODO: 執行各個來源的爬蟲
  // results.push(await crawlExample());

  log("抓取完成");

  // 儲存報告
  report.sources = results;
  finalizeReport(report);
  saveReport(report, "crawl");

  console.log("\n抓取完成！");
  console.log("請執行 pnpm run process 處理資料。");
}

main().catch(console.error);
