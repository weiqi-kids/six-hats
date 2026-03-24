/**
 * 認證服務
 *
 * Demo 模式登入（開發/測試用）
 */

import { upsertUser, getMainDb, type User } from "../db/index.js";

/**
 * 開發模式：建立一般用戶
 */
export function createDemoUser(displayName: string = "Demo User"): User {
  const sanitizedName = (displayName || "demo").toLowerCase().replace(/[^a-z0-9]/g, "-");
  return upsertUser({
    provider: "demo",
    provider_id: `demo-${sanitizedName}`,
    display_name: displayName || "Demo User",
    email: `${sanitizedName}@demo.local`,
  });
}

/**
 * 開發模式：建立管理員用戶
 */
export function createAdminUser(): User {
  const user = upsertUser({
    provider: "demo",
    provider_id: "admin",
    display_name: "Admin",
    email: "admin@example.com",
  });

  // 更新 role 為 admin
  const db = getMainDb();
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);

  return { ...user, role: "admin" };
}
