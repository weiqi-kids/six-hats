/**
 * Evaluator - 卡內基評估器
 */

import OpenAI from "openai";
import type {
  CarnegieEvaluation,
  BlueOpening,
  BlueReview,
  HatResponse,
  HatType,
  AnalysisContext,
} from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是卡內基問題解決評估專家，負責整合六帽分析結果，產出結構化的評估報告。

## 卡內基框架

### 1. Problem（問題）
- 明確定義問題是什麼
- 判斷問題類型：decision（決策）、emotion（情緒）、resource（資源）、information（資訊）

### 2. Cause（原因）
- primary: 主要原因
- controllable: 可控因素
- uncontrollable: 不可控因素

### 3. Method（方法）
- 列出 2-4 個可行方案
- 標註哪些帽子支持/反對

### 4. Best Process（最佳流程）
- 給出明確建議
- 設計執行步驟和檢查點

### 5. Deliverable（成果物）- 可選
- 如果用戶的目標是獲得具體的產出物（email、範本、企劃書、文案、腳本、合約草稿等），請在此整合六帽分析的洞察，產出完整的成果物
- 整合白帽的事實依據、紅帽的情感訴求、黑帽提醒的風險點、黃帽強調的價值、綠帽的創意元素
- 如果用戶的目標是分析或決策（而非具體產出物），此欄位設為 null

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "problem": {
    "statement": "問題陳述",
    "type": "decision|emotion|resource|information"
  },
  "cause": {
    "primary": ["主因1", "主因2"],
    "controllable": ["可控1", "可控2"],
    "uncontrollable": ["不可控1", "不可控2"]
  },
  "method": {
    "options": [
      {
        "title": "方案名稱",
        "description": "方案描述",
        "supportedBy": ["white", "yellow"],
        "opposedBy": ["black"]
      }
    ]
  },
  "bestProcess": {
    "recommendation": "最終建議（1-2句）",
    "steps": [
      { "step": 1, "action": "第一步行動", "checkpoint": "完成標準" },
      { "step": 2, "action": "第二步行動", "checkpoint": "完成標準" }
    ]
  },
  "deliverable": "完整的成果物內容（如 email 全文、範本等），若用戶不需要具體產出物則為 null"
}`;

interface EvaluatorInput {
  problem: string;
  opening: BlueOpening;
  hatResponses: Array<{ hat: HatType; result: HatResponse }>;
  review: BlueReview;
  context?: AnalysisContext;
}

export async function analyze(
  client: OpenAI,
  model: string,
  input: EvaluatorInput
): Promise<CarnegieEvaluation> {
  const { problem, opening, hatResponses, review, context } = input;

  const responsesText = hatResponses
    .map(
      ({ hat, result }) =>
        `[${hat.toUpperCase()} HAT]\n重點：${result.keyPoints.join("、")}`
    )
    .join("\n\n");

  const contextMessages = buildContextMessages(context);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...contextMessages,
      {
        role: "user",
        content: `原始問題：${problem}

問題定義：${opening.problemDefinition}
目標：${opening.goal}

六帽分析摘要：
${responsesText}

Blue Hat 檢核：
${review.summary}

請產出卡內基評估報告：`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2500,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("無法解析卡內基評估");
  }

  return JSON.parse(jsonMatch[0]) as CarnegieEvaluation;
}
