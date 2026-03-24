/**
 * Six Hats 共用工具函數
 */

import type OpenAI from "openai";
import type { AnalysisContext } from "./types.js";

/**
 * 根據 AnalysisContext 建立額外的 prompt messages
 * 用於注入用戶背景和 RAG 參考資料
 */
export function buildContextMessages(
  context?: AnalysisContext
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  // Layer 1: 用戶背景注入
  if (context?.userContext && Object.keys(context.userContext).length > 0) {
    const parts: string[] = [];

    if (context.userContext.role) {
      parts.push(`用戶角色：${context.userContext.role}`);
    }
    if (context.userContext.industry) {
      parts.push(`所屬產業：${context.userContext.industry}`);
    }
    if (context.userContext.expertise) {
      parts.push(`專業背景：${context.userContext.expertise}`);
    }

    // 其他自訂欄位
    for (const [key, value] of Object.entries(context.userContext)) {
      if (!["role", "industry", "expertise"].includes(key) && value) {
        parts.push(`${key}：${value}`);
      }
    }

    if (parts.length > 0) {
      messages.push({
        role: "user",
        content: `用戶背景資訊：\n${parts.join("\n")}\n\n請根據此背景調整你的分析角度和用語。`,
      });
    }
  }

  // Layer 2: RAG 參考資料注入
  if (context?.ragContext) {
    messages.push({
      role: "user",
      content: `以下是與此問題相關的參考資料，請在分析時參考：\n\n${context.ragContext}`,
    });
  }

  // Layer 3: 對話歷史注入（讓所有角色都看到前幾輪的結論）
  if (context?.previousMessages?.length) {
    messages.push({
      role: "user",
      content: `以下是之前的對話摘要，請在分析時參考前幾輪的結論，聚焦在用戶最新的追問上：\n\n${context.previousMessages.join("\n\n")}`,
    });
  }

  return messages;
}
