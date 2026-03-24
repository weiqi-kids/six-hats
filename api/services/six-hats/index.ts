/**
 * Six Hats 多角色分析引擎
 *
 * 協調 8 個角色完成完整的六帽思考分析：
 * 1. Blue Opening - 問題定義
 * 2-6. White/Red/Black/Yellow/Green - 五帽平行分析
 * 7. Blue Review - 檢核與補跑決策
 * 8. Evaluator - 卡內基評估
 */

import OpenAI from "openai";
import dotenv from "dotenv";
import { semanticSearchWithUserVectors } from "../rag.js";

import type {
  SixHatsAnalysis,
  AnalysisOptions,
  AnalysisStep,
  AnalysisContext,
  HatType,
  HatResponse,
} from "./types.js";

import * as blueOpening from "./roles/blue-opening.js";
import * as white from "./roles/white.js";
import * as red from "./roles/red.js";
import * as black from "./roles/black.js";
import * as yellow from "./roles/yellow.js";
import * as green from "./roles/green.js";
import * as blueReview from "./roles/blue-review.js";
import * as evaluator from "./roles/evaluator.js";

dotenv.config();

// 建立 OpenAI 客戶端（支援 OpenAI、Azure、Ollama）
function createClient(): { client: OpenAI; model: string } {
  const provider = process.env.LLM_PROVIDER;

  // 使用 Ollama 本地 LLM
  if (provider === "ollama") {
    const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = process.env.OLLAMA_CHAT_MODEL || "llama3.2";
    console.log(`[Six Hats] 使用 Ollama 本地 LLM (${model})`);
    return {
      client: new OpenAI({
        apiKey: "ollama",
        baseURL: `${baseURL}/v1`,
      }),
      model,
    };
  }

  // OpenAI 官方 API
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== "your-openai-api-key" && openaiKey !== "sk-xxx") {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    };
  }

  // Azure OpenAI
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  if (azureEndpoint && azureKey && azureKey !== "your-azure-api-key") {
    const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o";
    return {
      client: new OpenAI({
        apiKey: azureKey,
        baseURL: `${azureEndpoint}/openai/deployments/${deployment}`,
        defaultQuery: { "api-version": "2024-02-15-preview" },
        defaultHeaders: { "api-key": azureKey },
      }),
      model: deployment,
    };
  }

  throw new Error("請設定 LLM_PROVIDER=ollama、OPENAI_API_KEY 或 AZURE_OPENAI_* 環境變數");
}

// 五帽分析函數對應
const hatAnalyzers: Record<
  HatType,
  typeof white.analyze
> = {
  white: white.analyze,
  red: red.analyze,
  black: black.analyze,
  yellow: yellow.analyze,
  green: green.analyze,
};

/**
 * 執行完整六帽分析
 */
export async function analyzeWithSixHats(
  problem: string,
  options: AnalysisOptions = {},
  context?: AnalysisContext
): Promise<SixHatsAnalysis> {
  const { client, model } = createClient();
  const { maxRetries = 1, onStep } = options;

  // Layer 2: 搜尋用戶個人知識庫
  if (context?.userId && !context.ragContext) {
    try {
      const results = await semanticSearchWithUserVectors(problem, context.userId, 3);
      if (results.length > 0) {
        context = {
          ...context,
          ragContext: results
            .map((r, i) => `[參考資料 ${i + 1}] ${r.content}`)
            .join("\n\n"),
        };
      }
    } catch (err) {
      console.log("[Six Hats] RAG 搜尋跳過:", (err as Error).message);
    }
  }

  const notifyStep = (step: AnalysisStep) => {
    if (onStep) onStep(step);
    console.log(`[Six Hats] ${step.role}: ${step.status}`);
  };

  // ========== Phase 1: Blue Hat 開場 ==========
  notifyStep({ role: "blue-opening", status: "running" });
  const opening = await blueOpening.analyze(client, model, problem, context);
  notifyStep({ role: "blue-opening", status: "done", result: opening });

  // ========== Phase 2: 五帽平行分析 ==========
  const FIVE_HATS: HatType[] = ["white", "red", "black", "yellow", "green"];

  const hatPromises = FIVE_HATS.map(async (hat) => {
    notifyStep({ role: hat, status: "running" });
    const result = await hatAnalyzers[hat](client, model, problem, {
      ...context,
      opening,
    });
    notifyStep({ role: hat, status: "done", result });
    return { hat, result };
  });

  const hatResponses = await Promise.all(hatPromises);

  // ========== Phase 3: Blue Hat 檢核 ==========
  notifyStep({ role: "blue-review", status: "running" });
  const review = await blueReview.analyze(client, model, hatResponses, opening, context);
  notifyStep({ role: "blue-review", status: "done", result: review });

  // ========== Phase 3.5: 補跑（如需要）==========
  let rerunResponses: Array<{ hat: HatType; result: HatResponse }> | undefined;

  if (review.rerunRequired && review.hatsToRerun.length > 0) {
    rerunResponses = [];

    for (let retry = 0; retry < maxRetries; retry++) {
      for (const hat of review.hatsToRerun) {
        notifyStep({ role: hat, status: "rerun" });
        const result = await hatAnalyzers[hat](client, model, problem, {
          ...context,
          opening,
          rerunReason: review.rerunReasons[hat],
        });
        notifyStep({ role: hat, status: "done", result });
        rerunResponses.push({ hat, result });
      }
    }
  }

  // ========== Phase 4: 卡內基評估 ==========
  notifyStep({ role: "evaluator", status: "running" });
  const evaluation = await evaluator.analyze(client, model, {
    problem,
    opening,
    hatResponses: rerunResponses
      ? [...hatResponses, ...rerunResponses]
      : hatResponses,
    review,
    context,
  });
  notifyStep({ role: "evaluator", status: "done", result: evaluation });

  return {
    opening,
    hatResponses,
    review,
    rerunResponses,
    evaluation,
  };
}

/**
 * 格式化分析結果為可讀文字
 */
export function formatAnalysisResult(analysis: SixHatsAnalysis): string {
  const lines: string[] = [];

  lines.push("# 六帽思考分析報告\n");

  // Blue Hat 開場
  lines.push("## 1. 問題定義（Blue Hat）");
  lines.push(`**問題**：${analysis.opening.problemDefinition}`);
  lines.push(`**目標**：${analysis.opening.goal}`);
  lines.push(`**分析總結**：${analysis.opening.summary}\n`);

  // 五帽分析
  const hatNames: Record<HatType, string> = {
    white: "White Hat（事實）",
    red: "Red Hat（情感）",
    black: "Black Hat（風險）",
    yellow: "Yellow Hat（機會）",
    green: "Green Hat（創意）",
  };

  lines.push("## 2. 五帽分析");
  for (const { hat, result } of analysis.hatResponses) {
    lines.push(`### ${hatNames[hat]}`);
    lines.push(result.content);
    lines.push(`**重點**：${result.keyPoints.join("、")}\n`);
  }

  // Blue Hat 檢核
  lines.push("## 3. 檢核結果（Blue Hat）");
  lines.push(analysis.review.summary);
  if (analysis.review.rerunRequired) {
    lines.push(`**需要補充**：${analysis.review.hatsToRerun.join("、")}\n`);
  }

  // 卡內基評估
  lines.push("## 4. 卡內基評估");
  lines.push(`**問題類型**：${analysis.evaluation.problem.type}`);
  lines.push(`**問題陳述**：${analysis.evaluation.problem.statement}\n`);

  lines.push("### 原因分析");
  lines.push(`- 主要原因：${analysis.evaluation.cause.primary.join("、")}`);
  lines.push(`- 可控因素：${analysis.evaluation.cause.controllable.join("、")}`);
  lines.push(`- 不可控因素：${analysis.evaluation.cause.uncontrollable.join("、")}\n`);

  lines.push("### 方案選項");
  for (const option of analysis.evaluation.method.options) {
    lines.push(`**${option.title}**`);
    lines.push(`${option.description}`);
    if (option.supportedBy.length) {
      lines.push(`支持：${option.supportedBy.join("、")}`);
    }
    if (option.opposedBy.length) {
      lines.push(`反對：${option.opposedBy.join("、")}`);
    }
    lines.push("");
  }

  lines.push("### 建議流程");
  lines.push(`**建議**：${analysis.evaluation.bestProcess.recommendation}\n`);
  for (const step of analysis.evaluation.bestProcess.steps) {
    lines.push(`${step.step}. ${step.action}`);
    lines.push(`   檢查點：${step.checkpoint}`);
  }

  return lines.join("\n");
}

export * from "./types.js";
