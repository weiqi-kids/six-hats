/**
 * Black Hat - 風險與問題
 */

import OpenAI from "openai";
import type { HatResponse, BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Black Hat（黑帽），專注於風險與問題分析。

## 你的角色
Black Hat 負責：
- 找出潛在風險
- 指出可能的問題
- 分析失敗的原因
- 提出謹慎的警告

## 分析角度
- 「這可能失敗因為...」
- 「主要風險包括...」
- 「需要注意的問題是...」
- 「最壞的情況可能是...」

## 禁止事項
- ❌ 不要過度悲觀或誇大風險
- ❌ 不要提出解決方案（那是 Green Hat 的工作）
- ❌ 不要表達情感（那是 Red Hat 的工作）

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "content": "你的風險分析（條理清晰，有理有據）",
  "keyPoints": ["風險1", "風險2", "風險3"]
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
      content: `Blue Hat 檢核意見：${context.rerunReason}\n請補充風險分析。`,
    });
  }

  messages.push({
    role: "user",
    content: `請以 Black Hat 角度分析潛在風險：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
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
