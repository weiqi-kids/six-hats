/**
 * six-hats API 主入口
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

// 載入環境變數
dotenv.config();

// Session 中介層
import { sessionMiddleware } from "./middleware/session.js";

// 初始化資料庫
import { getMainDb, closeAllConnections } from "./db/index.js";

// Routes
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import searchRoutes from "./routes/search.js";
import sixHatsRoutes from "./routes/six-hats.js";
import attachmentRoutes from "./routes/attachments.js";
import multer from "multer";
import { optionalAuthMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.WEB_URL || "http://localhost:3001",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// 請求日誌
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// 健康檢查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/six-hats", optionalAuthMiddleware, sixHatsRoutes);

// 附件路由（含 multer file upload middleware）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.use("/api/six-hats/attachments", optionalAuthMiddleware, (req, res, next) => {
  if (req.path === "/upload" && req.method === "POST") {
    upload.single("file")(req, res, next);
  } else {
    next();
  }
}, attachmentRoutes);

// 靜態檔案（前端 build）
const webDistPath = path.join(import.meta.dirname, "../web/dist");
app.use(express.static(webDistPath));

// SPA fallback - 非 API 路由都返回 index.html
app.get("*", (req, res) => {
  // API 路由返回 404
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  // 其他路由返回前端 index.html
  res.sendFile(path.join(webDistPath, "index.html"));
});

// 錯誤處理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// 啟動伺服器
const server = app.listen(PORT, () => {
  // 初始化主資料庫
  getMainDb();
  console.log(`six-hats API running on http://localhost:${PORT}`);
});

// 優雅關閉
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  closeAllConnections();
  server.close();
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  closeAllConnections();
  server.close();
});
