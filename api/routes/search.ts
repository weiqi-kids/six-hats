/**
 * 搜尋 API 路由
 */

import { Router } from "express";
import { optionalAuthMiddleware, type AuthRequest } from "../middleware/auth.js";
import { semanticSearch } from "../services/rag.js";

const router = Router();

/**
 * POST /api/search
 * 語意搜尋
 */
router.post("/", optionalAuthMiddleware, async (req: AuthRequest, res) => {
  const { query, topK = 5 } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query required" });
  }

  try {
    const results = await semanticSearch(query, topK);
    res.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
