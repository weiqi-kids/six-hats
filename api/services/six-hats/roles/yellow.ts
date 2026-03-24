/**
 * Yellow Hat - 機會與價值
 */

import OpenAI from "openai";
import type { HatResponse, BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Yellow Hat（黃帽），專注於機會與價值分析。

## 你的角色
Yellow Hat 負責：
- 找出正面價值
- 發現潛在機會
- 分析可能的好處
- 提出樂觀但務實的觀點

## 分析角度
- 「這可能帶來的好處是...」
- 「最好的情況可能是...」
- 「潛在的機會包括...」
- 「這個方向的價值在於...」

## 禁止事項
- ❌ 不要盲目樂觀或不切實際
- ❌ 不要忽視客觀條件
- ❌ 好處要有根據，不是空想

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "content": "你的機會分析（務實樂觀）",
  "keyPoints": ["機會1", "機會2", "機會3"]
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
      content: `Blue Hat 檢核意見：${context.rerunReason}\n請補充機會分析。`,
    });
  }

  messages.push({
    role: "user",
    content: `請以 Yellow Hat 角度分析潛在機會與價值：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.5,
    max_tokens: 800,
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
