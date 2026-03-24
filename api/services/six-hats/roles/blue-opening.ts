/**
 * Blue Hat Opening - 問題定義與目標設定
 */

import OpenAI from "openai";
import type { BlueOpening, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Blue Hat（藍帽）主持人，負責開場定義問題。

## 你的角色
Blue Hat 是六頂思考帽的主持人，負責：
1. 定義問題的核心
2. 設定思考目標
3. 安排思考順序

## 輸出格式
請嚴格輸出以下 JSON 格式，不要有其他內容：
{
  "problemDefinition": "問題的核心定義（1-2句）",
  "goal": "這次思考要達成的目標",
  "thinkingOrder": ["white", "red", "black", "yellow", "green"],
  "summary": "開場總結（2-3句，說明接下來的分析方向）"
}

## 思考順序建議
- 決策問題：white → red → black → yellow → green
- 創意問題：green → white → yellow → black → red
- 風險評估：white → black → yellow → green → red

## 注意
- 問題定義要精準，不要太籠統
- 目標要可衡量
- 總結要引導後續五帽的分析方向
- 如果有之前的對話摘要，代表用戶正在追問。請聚焦在用戶最新的問題上，而非重複分析原始主題
- 追問的問題定義應該精準對應用戶當前的需求（例如：用戶問「怎麼聯絡」，問題定義就是聯絡策略；用戶問「幫我擬 email」，問題定義就是 email 撰寫）`;

export async function analyze(
  client: OpenAI,
  model: string,
  problem: string,
  context?: AnalysisContext
): Promise<BlueOpening> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // 注入用戶背景和 RAG 參考資料
  messages.push(...buildContextMessages(context));

  if (context?.previousMessages?.length) {
    messages.push({
      role: "user",
      content: `之前的對話摘要：\n${context.previousMessages.join("\n")}`,
    });
  }

  messages.push({
    role: "user",
    content: `請為以下問題定義分析框架：\n\n${problem}`,
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("無法解析 Blue Hat 開場");
  }

  return JSON.parse(jsonMatch[0]) as BlueOpening;
}
