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
  updateConversationTitle,
} from "../db/index.js";
import { chat, type ChatMessage, type FlowStep } from "../services/llm.js";

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
  const userId = req.userId!;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  try {
    // 取得對話歷史
    const existingMessages = getMessages(userId, conversationId);
    const history: ChatMessage[] = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 儲存用戶訊息
    addMessage(userId, conversationId, "user", message);

    // 呼叫 LLM
    const response = await chat(message, history);

    // 儲存助手回覆
    const assistantMessage = addMessage(
      userId,
      conversationId,
      "assistant",
      response.content,
      response.citations
    );

    // 自動設定對話標題
    if (existingMessages.length === 0) {
      const autoTitle = message.substring(0, 50) + (message.length > 50 ? "..." : "");
      updateConversationTitle(userId, conversationId, autoTitle);
    }

    res.json({
      message: assistantMessage,
      citations: response.citations,
      flowTrace: response.flowTrace,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

/**
 * POST /api/chat/conversations/:id/messages/stream
 * 發送訊息（SSE 串流步驟進度）
 */
router.post("/conversations/:id/messages/stream", authMiddleware, async (req: AuthRequest, res) => {
  const { message } = req.body;
  const conversationId = req.params.id;
  const userId = req.userId!;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  const conversation = getConversation(userId, conversationId);
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // 設定 SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // 取得對話歷史
    const existingMessages = getMessages(userId, conversationId);
    const history: ChatMessage[] = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 儲存用戶訊息
    addMessage(userId, conversationId, "user", message);

    // 呼叫 LLM，帶 onStep callback 即時回報進度
    const response = await chat(message, history, (step: FlowStep) => {
      res.write(`data: ${JSON.stringify({ type: "step", step })}\n\n`);
    });

    // 儲存助手回覆
    const assistantMessage = addMessage(
      userId,
      conversationId,
      "assistant",
      response.content,
      response.citations
    );

    // 自動設定對話標題
    if (existingMessages.length === 0) {
      const autoTitle = message.substring(0, 50) + (message.length > 50 ? "..." : "");
      updateConversationTitle(userId, conversationId, autoTitle);
    }

    // 傳送最終結果
    res.write(`data: ${JSON.stringify({
      type: "done",
      message: assistantMessage,
      citations: response.citations,
      warning: response.warning,
      flowTrace: response.flowTrace,
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat stream error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", error: "Chat failed" })}\n\n`);
    res.end();
  }
});

export default router;
