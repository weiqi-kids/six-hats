/**
 * 工具函式
 */

import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const CHUNKS_DIR = path.join(DATA_DIR, "chunks");

/**
 * 確保目錄存在
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 儲存原始資料
 */
export function saveRawData(source: string, data: unknown): void {
  ensureDir(RAW_DIR);
  const filePath = path.join(RAW_DIR, `${source}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * 載入原始資料
 */
export function loadRawData<T>(source: string): T | null {
  const filePath = path.join(RAW_DIR, `${source}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return null;
}

/**
 * 儲存 chunks
 */
export function saveChunks(source: string, chunks: unknown[]): void {
  ensureDir(CHUNKS_DIR);
  const filePath = path.join(CHUNKS_DIR, `${source}.json`);
  fs.writeFileSync(filePath, JSON.stringify(chunks, null, 2));
}

/**
 * 載入 chunks
 */
export function loadChunks<T>(source: string): T[] {
  const filePath = path.join(CHUNKS_DIR, `${source}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }
  return [];
}

/**
 * 列出所有原始資料檔案
 */
export function listRawFiles(): string[] {
  ensureDir(RAW_DIR);
  return fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/**
 * 列出所有 chunks 檔案
 */
export function listChunkFiles(): string[] {
  ensureDir(CHUNKS_DIR);
  return fs
    .readdirSync(CHUNKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/**
 * 計算檔案 hash (用於差異比對)
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * 日誌輸出
 */
export function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * 預設的 HTTP 請求標頭
 */
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
};

/**
 * 具有重試和錯誤處理的 fetch
 */
export async function fetchWithRetry(
  url: string,
  options: {
    maxRetries?: number;
    timeout?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<{ ok: boolean; text: string; status: number }> {
  const { maxRetries = 3, timeout = 30000, headers = {} } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      return {
        ok: response.ok,
        text,
        status: response.status,
      };
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          ok: false,
          text: "",
          status: 0,
        };
      }
      // 等待後重試
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }

  return { ok: false, text: "", status: 0 };
}

/**
 * 延遲執行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
