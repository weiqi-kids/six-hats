/**
 * 個人知識庫附件管理 API
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import { initSixHatsDb } from "../db/schema.js";
import { chunkText } from "../../crawlers/libs/chunker.js";
import { embed, embedBatch } from "../../crawlers/libs/embedder.js";
import {
  upsertVectors,
  deleteVectorsByUploadId,
  setVectorsHiddenByUploadId,
  saveVectorStore,
  loadVectorStore,
} from "../../crawlers/libs/vector-store.js";
import { fetchWithRetry } from "../../crawlers/libs/utils.js";

const router = Router();

// 上傳檔案大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getUserId(req: Request): string {
  return (req as any).userId || "anonymous";
}

function getUserStoreName(userId: string): string {
  return `user-${userId}`;
}

interface AttachmentRow {
  id: string;
  filename: string;
  original_name: string;
  content_type: string;
  source_type: string;
  source_url: string | null;
  chunk_count: number;
  enabled: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * 提取文字內容
 */
async function extractText(
  sourceType: string,
  content: string | Buffer,
  contentType?: string
): Promise<string> {
  if (sourceType === "text") {
    return content as string;
  }

  if (sourceType === "url") {
    const url = content as string;
    // 使用 cheerio 提取（已有依賴）
    const cheerio = await import("cheerio");
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);
    // 移除不需要的元素
    $("script, style, nav, footer, header, iframe").remove();
    const text = $("main, article, .content, body").first().text();
    return text.replace(/\s+/g, " ").trim();
  }

  if (sourceType === "file") {
    const mimeType = contentType || "";

    // PDF
    if (mimeType === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(content as Buffer);
      return data.text;
    }

    // Word (.docx)
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: content as Buffer });
      return result.value;
    }

    // Markdown / 純文字
    return (content as Buffer).toString("utf-8");
  }

  throw new Error(`不支援的來源類型: ${sourceType}`);
}

/**
 * 處理文字：chunk → embed → 儲存向量
 */
async function processText(
  userId: string,
  attachmentId: string,
  text: string,
  filename: string
): Promise<number> {
  const storeName = getUserStoreName(userId);

  // 切分
  const chunks = chunkText(text, {
    source: filename,
    uploadId: attachmentId,
  });

  if (chunks.length === 0) return 0;

  // 嵌入
  const vectors = await embedBatch(chunks.map((c) => c.content));

  // 組合向量條目
  const entries = chunks.map((chunk, i) => ({
    id: `${attachmentId}-${i}`,
    content: chunk.content,
    vector: vectors[i],
    metadata: {
      ...chunk.metadata,
      uploadId: attachmentId,
      source: filename,
    },
  }));

  // 儲存
  upsertVectors(storeName, entries);
  saveVectorStore(storeName, loadVectorStore(storeName));

  return chunks.length;
}

/**
 * 列出附件
 * GET /api/six-hats/attachments
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const db = initSixHatsDb(userId);

    const rows = db
      .prepare("SELECT * FROM user_attachments ORDER BY created_at DESC")
      .all() as AttachmentRow[];

    res.json({
      attachments: rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        originalName: row.original_name,
        contentType: row.content_type,
        sourceType: row.source_type,
        sourceUrl: row.source_url,
        chunkCount: row.chunk_count,
        enabled: row.enabled === 1,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("List attachments error:", error);
    res.status(500).json({ error: "Failed to list attachments" });
  }
});

/**
 * 上傳檔案
 * POST /api/six-hats/attachments/upload
 */
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    // 從 raw body 讀取檔案（需要 multer 中介層）
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const attachmentId = uuidv4();
    const db = initSixHatsDb(userId);

    // 儲存元資料
    db.prepare(`
      INSERT INTO user_attachments (id, filename, original_name, content_type, source_type, status)
      VALUES (?, ?, ?, ?, 'file', 'processing')
    `).run(attachmentId, file.originalname, file.originalname, file.mimetype);

    // 提取文字並處理
    try {
      const text = await extractText("file", file.buffer, file.mimetype);
      const chunkCount = await processText(userId, attachmentId, text, file.originalname);

      db.prepare(`
        UPDATE user_attachments
        SET chunk_count = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(chunkCount, attachmentId);

      const row = db
        .prepare("SELECT * FROM user_attachments WHERE id = ?")
        .get(attachmentId) as AttachmentRow;

      res.json({
        attachment: {
          id: row.id,
          filename: row.filename,
          originalName: row.original_name,
          contentType: row.content_type,
          sourceType: row.source_type,
          chunkCount: row.chunk_count,
          enabled: row.enabled === 1,
          status: row.status,
          createdAt: row.created_at,
        },
      });
    } catch (err) {
      db.prepare(`
        UPDATE user_attachments SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(attachmentId);
      throw err;
    }
  } catch (error) {
    console.error("Upload attachment error:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

/**
 * 提交文字
 * POST /api/six-hats/attachments/text
 */
router.post("/text", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { text, title } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const attachmentId = uuidv4();
    const filename = title || `文字筆記 ${new Date().toLocaleDateString("zh-TW")}`;
    const db = initSixHatsDb(userId);

    db.prepare(`
      INSERT INTO user_attachments (id, filename, original_name, content_type, source_type, status)
      VALUES (?, ?, ?, 'text/plain', 'text', 'processing')
    `).run(attachmentId, filename, filename);

    const chunkCount = await processText(userId, attachmentId, text, filename);

    db.prepare(`
      UPDATE user_attachments
      SET chunk_count = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(chunkCount, attachmentId);

    const row = db
      .prepare("SELECT * FROM user_attachments WHERE id = ?")
      .get(attachmentId) as AttachmentRow;

    res.json({
      attachment: {
        id: row.id,
        filename: row.filename,
        originalName: row.original_name,
        chunkCount: row.chunk_count,
        enabled: row.enabled === 1,
        status: row.status,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error("Add text attachment error:", error);
    res.status(500).json({ error: "Failed to add text" });
  }
});

/**
 * 提交 URL
 * POST /api/six-hats/attachments/url
 */
router.post("/url", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "url is required" });
    }

    const attachmentId = uuidv4();
    const filename = url;
    const db = initSixHatsDb(userId);

    db.prepare(`
      INSERT INTO user_attachments (id, filename, original_name, content_type, source_type, source_url, status)
      VALUES (?, ?, ?, 'text/html', 'url', ?, 'processing')
    `).run(attachmentId, filename, filename, url);

    try {
      const text = await extractText("url", url);
      const chunkCount = await processText(userId, attachmentId, text, url);

      db.prepare(`
        UPDATE user_attachments
        SET chunk_count = ?, status = 'ready', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(chunkCount, attachmentId);

      const row = db
        .prepare("SELECT * FROM user_attachments WHERE id = ?")
        .get(attachmentId) as AttachmentRow;

      res.json({
        attachment: {
          id: row.id,
          filename: row.filename,
          sourceUrl: row.source_url,
          chunkCount: row.chunk_count,
          enabled: row.enabled === 1,
          status: row.status,
          createdAt: row.created_at,
        },
      });
    } catch (err) {
      db.prepare(`
        UPDATE user_attachments SET status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(attachmentId);
      throw err;
    }
  } catch (error) {
    console.error("Add URL attachment error:", error);
    res.status(500).json({ error: "Failed to fetch URL" });
  }
});

/**
 * 開關附件
 * PATCH /api/six-hats/attachments/:id/toggle
 */
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const db = initSixHatsDb(userId);
    const row = db
      .prepare("SELECT * FROM user_attachments WHERE id = ?")
      .get(id) as AttachmentRow | undefined;

    if (!row) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const newEnabled = row.enabled === 1 ? 0 : 1;
    const hidden = newEnabled === 0;

    // 更新 DB
    db.prepare(`
      UPDATE user_attachments
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newEnabled, id);

    // 更新向量 hidden 標記
    const storeName = getUserStoreName(userId);
    setVectorsHiddenByUploadId(storeName, id, hidden);
    saveVectorStore(storeName, loadVectorStore(storeName));

    res.json({
      id,
      enabled: newEnabled === 1,
    });
  } catch (error) {
    console.error("Toggle attachment error:", error);
    res.status(500).json({ error: "Failed to toggle attachment" });
  }
});

/**
 * 刪除附件
 * DELETE /api/six-hats/attachments/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const db = initSixHatsDb(userId);

    const row = db
      .prepare("SELECT id FROM user_attachments WHERE id = ?")
      .get(id) as { id: string } | undefined;

    if (!row) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // 刪除向量
    const storeName = getUserStoreName(userId);
    deleteVectorsByUploadId(storeName, id);
    saveVectorStore(storeName, loadVectorStore(storeName));

    // 刪除 DB 記錄
    db.prepare("DELETE FROM user_attachments WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete attachment error:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export default router;
