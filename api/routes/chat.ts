/**
 * 對話 API 路由
 */

import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import {
  createConversation,
  getConversations,
  getConversation,
  deleteConversation,
  addMessage,
  getMessages,
} from "../db/index.js";
import { chat, type ChatMessage } from "../services/llm.js";

const router = Router();

/**
 * POST /api/chat/conversations
 * 建立新對話
 */
router.post("/conversations", authMiddleware, (req: AuthRequest, res) => {
  const { title } = req.body;
  const conversation = createConversation(req.userId!, title);
  res.json(conversation);
});

/**
 * GET /api/chat/conversations
 * 取得對話列表
 */
router.get("/conversations", authMiddleware, (req: AuthRequest, res) => {
  const conversations = getConversations(req.userId!);
  res.json(conversations);
});

/**
 * GET /api/chat/conversations/:id
 * 取得單一對話
 */
router.get("/conversations/:id", authMiddleware, (req: AuthRequest, res) => {
  const conversation = getConversation(req.userId!, req.params.id);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  res.json(conversation);
});

/**
 * DELETE /api/chat/conversations/:id
 * 刪除對話
 */
router.delete("/conversations/:id", authMiddleware, (req: AuthRequest, res) => {
  deleteConversation(req.userId!, req.params.id);
  res.json({ success: true });
});

/**
 * GET /api/chat/conversations/:id/messages
 * 取得對話訊息
 */
router.get("/conversations/:id/messages", authMiddleware, (req: AuthRequest, res) => {
  const messages = getMessages(req.userId!, req.params.id);
  res.json(messages);
});

/**
 * POST /api/chat/conversations/:id/messages
 * 發送訊息
 */
router.post("/conversations/:id/messages", authMiddleware, async (req: AuthRequest, res) => {
  const { message } = req.body;
  const conversationId = req.params.id;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    // 取得對話歷史
    const existingMessages = getMessages(req.userId!, conversationId);
    const history: ChatMessage[] = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 儲存用戶訊息
    addMessage(req.userId!, conversationId, "user", message);

    // 呼叫 LLM
    const response = await chat(message, history);

    // 儲存助手回覆
    const assistantMessage = addMessage(
      req.userId!,
      conversationId,
      "assistant",
      response.content,
      response.citations
    );

    res.json({
      message: assistantMessage,
      citations: response.citations,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

export default router;
