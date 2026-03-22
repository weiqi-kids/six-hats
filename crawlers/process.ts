/**
 * 處理入口
 *
 * 用法: pnpm run process
 *
 * 將 raw 資料處理成 chunks 和 vectors
 */

import "dotenv/config";
import { log } from "./libs/utils.js";
import { processAllSources, type SourceDefinition } from "./libs/processor.js";
import { createReport, finalizeReport, saveReport } from "./libs/reporter.js";
import { closeBrowser } from "./libs/browser.js";

// TODO: 定義各個來源的處理方式
const sources: SourceDefinition[] = [
  // 範例：
  // {
  //   name: "example",
  //   displayName: "範例來源",
  //   expandRawData: (rawData: unknown) => {
  //     const data = rawData as Array<{ id: string; content: string }>;
  //     return data.map((item) => ({
  //       id: `example-${item.id}`,
  //       content: item.content,
  //       metadata: { source: "example" },
  //     }));
  //   },
  // },
];

async function main() {
  log("開始處理資料...");

  const report = createReport();

  if (sources.length === 0) {
    console.log("\n尚未定義資料來源。");
    console.log("請在 crawlers/process.ts 中定義 sources 陣列。");
    return;
  }

  const results = await processAllSources(sources);

  report.sources = results;
  finalizeReport(report);
  saveReport(report, "process");

  log("處理完成！");

  // 關閉瀏覽器
  await closeBrowser();
}

main().catch(console.error);
