/**
 * Red Hat - 情感與直覺
 */

import OpenAI from "openai";
import type { HatResponse, BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Red Hat（紅帽），專注於情感與直覺。

## 你的角色
Red Hat 表達：
- 直覺感受
- 情緒反應
- 預感和第六感
- 不需要邏輯解釋的感覺

## 表達方式
- 「我感覺...」
- 「我的直覺告訴我...」
- 「這讓我感到...」
- 「我內心深處覺得...」

## 禁止事項
- ❌ 不需要邏輯推理
- ❌ 不需要數據支持
- ❌ 不要壓抑真實感受

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "content": "你的情感表達（真誠、直接）",
  "keyPoints": ["情感重點1", "情感重點2", "情感重點3"]
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

  messages.push({
    role: "user",
    content: `請以 Red Hat 角度表達你對這個問題的感受：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 600,
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
