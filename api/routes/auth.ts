/**
 * 認證路由
 */

import { Router, Response } from "express";
import { generateToken, authMiddleware, type AuthRequest, type UserRole } from "../middleware/auth.js";
import { type SessionRequest, getSessionId } from "../middleware/session.js";
import { createDemoUser, createAdminUser } from "../services/auth.js";

const router = Router();

/**
 * POST /api/auth/anonymous
 * 匿名登入
 */
router.post("/anonymous", (req: SessionRequest, res: Response) => {
  const sessionId = getSessionId(req);

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID not found" });
  }

  const token = generateToken(sessionId, "anonymous");

  res.json({
    token,
    user: {
      id: sessionId,
      provider: "anonymous",
      provider_id: sessionId,
      email: null,
      display_name: "訪客",
      avatar_url: null,
      role: "anonymous",
      created_at: new Date().toISOString(),
      last_login_at: null,
    },
  });
});

/**
 * GET /api/auth/me
 * 取得當前用戶資訊
 */
router.get("/me", authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/demo
 * Demo 模式登入（開發/測試用）
 */
router.post("/demo", (req, res) => {
  const { displayName, admin } = req.body;

  const user = admin ? createAdminUser() : createDemoUser(displayName);
  const token = generateToken(user.id, user.role as UserRole);

  res.json({ token, user });
});

/**
 * POST /api/auth/logout
 * 登出
 */
router.post("/logout", (req, res) => {
  res.json({ success: true });
});

export default router;
