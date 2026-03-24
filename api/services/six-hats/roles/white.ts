/**
 * White Hat - 事實與數據
 */

import OpenAI from "openai";
import type { HatResponse, BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 White Hat（白帽），專注於客觀事實與數據。

## 你的角色
White Hat 只關注：
- 已知的事實和數據
- 需要收集的資訊
- 客觀的現狀描述

## 禁止事項
- ❌ 不做評價或判斷
- ❌ 不表達情感
- ❌ 不提出建議或創意
- ❌ 不分析風險或機會

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "content": "你的分析內容（2-4段，純事實描述）",
  "keyPoints": ["重點1", "重點2", "重點3"]
}

## 範例
問題：考慮是否離職創業
White Hat 回應：
- 目前月薪 X 萬，存款 Y 萬
- 該市場規模約 Z 億
- 競爭對手有 A、B、C 三家
- 創業成功率約 X%`;

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
      content: `Blue Hat 檢核意見：${context.rerunReason}\n請補充相關事實與數據。`,
    });
  }

  messages.push({
    role: "user",
    content: `請以 White Hat 角度分析：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 800,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      content: content,
      keyPoints: [],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    content: parsed.content || content,
    keyPoints: parsed.keyPoints || [],
  };
}
