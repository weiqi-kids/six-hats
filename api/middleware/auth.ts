/**
 * JWT 認證中介層
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUser, type User } from "../db/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

export type UserRole = "anonymous" | "user" | "admin";

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
  role?: UserRole;
}

/**
 * 產生 JWT Token
 */
export function generateToken(userId: string, role: UserRole = "user"): string {
  const expiresIn = role === "anonymous" ? "30d" : "7d";
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn });
}

/**
 * 驗證 JWT Token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * 認證中介層
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return;
  }

  req.userId = payload.userId;
  req.role = payload.role;

  // 匿名用戶
  if (payload.role === "anonymous") {
    req.user = {
      id: payload.userId,
      provider: "anonymous",
      provider_id: payload.userId,
      email: null,
      display_name: "訪客",
      avatar_url: null,
      role: "anonymous",
      created_at: new Date().toISOString(),
      last_login_at: null,
    };
    next();
    return;
  }

  // 登入用戶
  const user = getUser(payload.userId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized: User not found" });
    return;
  }

  req.user = user;
  req.role = user.role as UserRole;
  next();
}

/**
 * 可選認證中介層
 */
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      req.userId = payload.userId;
      req.role = payload.role;
    }
  }

  next();
}
