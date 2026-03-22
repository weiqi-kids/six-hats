/**
 * Session Cookie 管理中介層
 */

import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export interface SessionRequest extends Request {
  sessionId?: string;
}

/**
 * Session 中介層
 */
export function sessionMiddleware(
  req: SessionRequest,
  res: Response,
  next: NextFunction
): void {
  let sessionId = req.cookies?.session_id;

  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie("session_id", sessionId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 天
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  req.sessionId = sessionId;
  next();
}

/**
 * 取得 session_id
 */
export function getSessionId(req: SessionRequest): string | undefined {
  return req.sessionId || req.cookies?.session_id;
}
