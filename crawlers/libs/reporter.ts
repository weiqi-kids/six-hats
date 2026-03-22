/**
 * 同步報告模組
 *
 * 用於追蹤和記錄同步操作的結果
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");

/**
 * 報告類型
 */
export type ReportType = "crawl" | "process";

/**
 * 單一資料來源的同步結果
 */
export interface SourceResult {
  name: string;
  status: "success" | "partial" | "failed";
  rawCount: number;
  chunkCount: number;
  vectorCount: number;
  errors: string[];
  duration: number; // ms
}

/**
 * 同步報告摘要
 */
export interface ReportSummary {
  total: number;
  success: number;
  partial: number;
  failed: number;
  totalRaw: number;
  totalChunks: number;
  totalVectors: number;
}

/**
 * 完整同步報告
 */
export interface SyncReport {
  version: "1.0";
  type?: ReportType;
  startedAt: string;
  completedAt: string;
  totalDuration: number;
  sources: SourceResult[];
  summary: ReportSummary;
}

/**
 * 確保目錄存在
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 建立空報告
 */
export function createReport(): SyncReport {
  return {
    version: "1.0",
    startedAt: new Date().toISOString(),
    completedAt: "",
    totalDuration: 0,
    sources: [],
    summary: {
      total: 0,
      success: 0,
      partial: 0,
      failed: 0,
      totalRaw: 0,
      totalChunks: 0,
      totalVectors: 0,
    },
  };
}

/**
 * 計算報告摘要
 */
export function calculateSummary(sources: SourceResult[]): ReportSummary {
  const summary: ReportSummary = {
    total: sources.length,
    success: 0,
    partial: 0,
    failed: 0,
    totalRaw: 0,
    totalChunks: 0,
    totalVectors: 0,
  };

  for (const source of sources) {
    switch (source.status) {
      case "success":
        summary.success++;
        break;
      case "partial":
        summary.partial++;
        break;
      case "failed":
        summary.failed++;
        break;
    }
    summary.totalRaw += source.rawCount;
    summary.totalChunks += source.chunkCount;
    summary.totalVectors += source.vectorCount;
  }

  return summary;
}

/**
 * 完成報告
 */
export function finalizeReport(report: SyncReport): void {
  report.completedAt = new Date().toISOString();
  report.totalDuration =
    new Date(report.completedAt).getTime() -
    new Date(report.startedAt).getTime();
  report.summary = calculateSummary(report.sources);
}

/**
 * 取得報告檔案路徑
 */
function getReportPath(type: ReportType): string {
  return path.join(REPORTS_DIR, `latest-${type}.json`);
}

/**
 * 儲存報告
 */
export function saveReport(report: SyncReport, type: ReportType): void {
  ensureDir(REPORTS_DIR);
  report.type = type;
  const filePath = getReportPath(type);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
}

/**
 * 載入最新報告
 */
export function loadLatestReport(type: ReportType): SyncReport | null {
  const filePath = getReportPath(type);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return null;
}

/**
 * 載入所有最新報告
 */
export function loadAllLatestReports(): {
  crawl: SyncReport | null;
  process: SyncReport | null;
} {
  return {
    crawl: loadLatestReport("crawl"),
    process: loadLatestReport("process"),
  };
}

/**
 * 格式化時間 (ms -> 可讀格式)
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * 取得狀態圖示
 */
function getStatusIcon(status: SourceResult["status"]): string {
  switch (status) {
    case "success":
      return "✓";
    case "partial":
      return "⚠";
    case "failed":
      return "✗";
  }
}

/**
 * 取得報告類型顯示名稱
 */
function getReportTypeLabel(type?: ReportType): string {
  switch (type) {
    case "crawl":
      return "抓取報告";
    case "process":
      return "處理報告";
    default:
      return "同步報告";
  }
}

/**
 * 產生報告摘要文字
 */
export function getReportSummary(report: SyncReport): string {
  const lines: string[] = [];
  const date = new Date(report.completedAt || report.startedAt);
  const dateStr = date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  const typeLabel = getReportTypeLabel(report.type);

  lines.push(`\n=== ${typeLabel} (${dateStr}) ===\n`);
  lines.push("來源狀態:");

  for (const source of report.sources) {
    const icon = getStatusIcon(source.status);
    const name = source.name.padEnd(20);
    const chunks = `${source.chunkCount} chunks`.padStart(12);
    const duration = formatDuration(source.duration);

    let errorInfo = "";
    if (source.errors.length > 0) {
      errorInfo = `  (${source.errors[0].substring(0, 30)}...)`;
    }

    lines.push(`  ${icon} ${name}${chunks}  (${duration})${errorInfo}`);
  }

  lines.push("");
  lines.push("摘要:");
  lines.push(
    `  成功: ${report.summary.success}  部分: ${report.summary.partial}  失敗: ${report.summary.failed}`
  );
  lines.push(
    `  總計: ${report.summary.totalChunks} chunks / ${report.summary.totalVectors} vectors`
  );
  lines.push(`  耗時: ${formatDuration(report.totalDuration)}`);
  lines.push("");

  return lines.join("\n");
}

/**
 * 建立來源結果的輔助函式
 */
export function createSourceResult(
  name: string,
  options: {
    rawCount?: number;
    chunkCount?: number;
    vectorCount?: number;
    errors?: string[];
    duration?: number;
  } = {}
): SourceResult {
  const {
    rawCount = 0,
    chunkCount = 0,
    vectorCount = 0,
    errors = [],
    duration = 0,
  } = options;

  let status: SourceResult["status"] = "success";
  if (errors.length > 0 || chunkCount === 0) {
    status = rawCount > 0 || chunkCount > 0 ? "partial" : "failed";
  }

  return {
    name,
    status,
    rawCount,
    chunkCount,
    vectorCount,
    errors,
    duration,
  };
}
