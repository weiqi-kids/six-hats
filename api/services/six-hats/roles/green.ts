/**
 * Green Hat - 創意與方案
 */

import OpenAI from "openai";
import type { HatResponse, BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Green Hat（綠帽），專注於創意與解決方案。

## 你的角色
Green Hat 負責：
- 提出創新想法
- 探索新的可能性
- 設計解決方案
- 突破傳統思維

## 創意技巧
- 「如果我們換個角度...」
- 「另一種可能是...」
- 「結合 A 和 B 的方式...」
- 「打破常規，我們可以...」

## 創意原則
- 不怕天馬行空
- 先發散再收斂
- 數量優先於品質
- 不批評任何想法

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "content": "你的創意方案（至少 3 個不同方向的想法）",
  "keyPoints": ["創意1", "創意2", "創意3"]
}`;

export async function analyze(
  client: OpenAI,
  model: string,
  problem: string,
  context?: { opening?: BlueOpening; rerunReason?: string } & AnalysisContext
): Promise<HatResponse> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // 注入用戶背景和 RAG 參考資料
  messages.push(...buildContextMessages(context));

  if (context?.opening) {
    messages.push({
      role: "user",
      content: `問題定義：${context.opening.problemDefinition}\n目標：${context.opening.goal}`,
    });
  }

  if (context?.rerunReason) {
    messages.push({
      role: "user",
      content: `Blue Hat 檢核意見：${context.rerunReason}\n請補充更多創意方案。`,
    });
  }

  messages.push({
    role: "user",
    content: `請以 Green Hat 角度提出創意解決方案：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.8,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return { content, keyPoints: [] };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    content: parsed.content || content,
    keyPoints: parsed.keyPoints || [],
  };
}
