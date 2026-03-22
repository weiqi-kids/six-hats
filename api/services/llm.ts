/**
 * LLM 對話服務
 *
 * 支援 OpenAI 官方 API 和 Azure OpenAI
 */

import OpenAI from "openai";
import dotenv from "dotenv";
import { buildContext, searchForCitationsWithScore } from "./rag.js";
import type { Citation } from "../db/index.js";

dotenv.config();

// 建立 OpenAI 客戶端（自動偵測使用 OpenAI 或 Azure）
function createClient(): { client: OpenAI; model: string } {
  // 優先使用 OpenAI 官方 API
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== "your-openai-api-key") {
    console.log("[LLM] 使用 OpenAI 官方 API");
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    };
  }

  // 其次使用 Azure OpenAI
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  if (azureEndpoint && azureKey && azureKey !== "your-azure-api-key") {
    console.log("[LLM] 使用 Azure OpenAI");
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

  // 沒有設定，拋出錯誤
  throw new Error("請設定 OPENAI_API_KEY 或 AZURE_OPENAI_* 環境變數");
}

let _clientInstance: { client: OpenAI; model: string } | null = null;

function getClient(): { client: OpenAI; model: string } {
  if (!_clientInstance) {
    _clientInstance = createClient();
  }
  return _clientInstance;
}

// TODO: 根據知識庫主題修改此系統提示詞
const SYSTEM_PROMPT = `你是一個專業的知識庫問答助手。你的任務是根據提供的資料來源，準確回答用戶的問題。

## 回答準則

1. **準確性**：只根據提供的資料來源回答，不要編造或猜測資訊
2. **引用來源**：回答時要標註資料來源
3. **結構清晰**：使用條列式或分段方式呈現複雜資訊
4. **實用性**：提供具體可行的建議或步驟
5. **誠實**：如果資料不足以回答問題，請明確說明

## 回答格式

1. 先簡要回答問題核心
2. 詳細說明相關依據
3. 提供實務建議或注意事項
4. 如有需要，提醒用戶諮詢專業人員`;

// TODO: 根據知識庫主題修改服務範疇描述
const SCOPE_DESCRIPTION = `## 服務範疇
- 本知識庫涵蓋的主題領域
- 相關的問答類型

## 不屬於服務範疇
- 與本知識庫無關的問題
- 一般生活問題`;

// TODO: 根據知識庫主題修改建議問題
const SUGGESTED_QUESTIONS = [
  "請問如何使用本知識庫？",
  "本知識庫包含哪些資料？",
];

/**
 * 檢查問題是否屬於服務範疇
 */
async function checkScope(
  question: string,
  conversationHistory: ChatMessage[] = []
): Promise<{ inScope: boolean; reason?: string }> {
  const { client, model } = getClient();

  // 組合對話上下文摘要
  const recentHistory = conversationHistory.slice(-4);
  const contextSummary = recentHistory.length > 0
    ? `## 對話上下文\n${recentHistory.map(m => `${m.role}: ${m.content.substring(0, 100)}...`).join("\n")}\n\n`
    : "";

  const scopePrompt = `你是知識庫諮詢系統的輸入過濾器。請判斷以下問題是否屬於服務範疇。

${SCOPE_DESCRIPTION}

## 判斷規則
- 如果對話上下文是在討論相關問題，後續的追問應視為在範疇內
- 只有完全無關的問題才判定為不在範疇內

${contextSummary}## 用戶問題
${question}

請用 JSON 格式回覆：
{"inScope": true/false, "reason": "簡短說明"}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: scopePrompt }],
      temperature: 0,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Scope check error:", error);
  }

  // 預設假設在範疇內
  return { inScope: true };
}

/**
 * 產生任務拆解步驟
 */
async function generateWorkflow(question: string): Promise<string[]> {
  const { client, model } = getClient();

  const workflowPrompt = `請將以下問題拆解成 2-4 個簡短的處理步驟（每步驟不超過 10 個字）。
直接輸出 JSON 陣列格式，例如：["分析問題", "查詢資料", "整合回覆"]

問題：${question}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: workflowPrompt }],
      temperature: 0,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Workflow generation error:", error);
  }

  return ["分析問題", "查詢資料", "整合回覆"];
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface FlowStep {
  node: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface FlowTrace {
  steps: FlowStep[];
  totalDuration: number;
}

export interface ChatResponse {
  content: string;
  citations: Citation[];
  workflow?: string[];
  selfCheck?: string;
  flowTrace?: FlowTrace;
}

export type OnStepCallback = (step: FlowStep) => void;

/**
 * 輔助函數：記錄步驟並通知 callback
 */
function pushStep(steps: FlowStep[], step: FlowStep, onStep?: OnStepCallback): void {
  steps.push(step);
  if (onStep) onStep(step);
}

/**
 * 輔助函數：計時執行並記錄步驟
 */
async function trackStep<T>(
  steps: FlowStep[],
  node: string,
  fn: () => Promise<T>,
  getDetail?: (result: T) => string,
  onStep?: OnStepCallback
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    const step: FlowStep = {
      node,
      status: 'success',
      duration,
      detail: getDetail ? getDetail(result) : undefined,
    };
    pushStep(steps, step, onStep);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const step: FlowStep = {
      node,
      status: 'failed',
      duration,
      detail: error instanceof Error ? error.message : '未知錯誤',
    };
    pushStep(steps, step, onStep);
    throw error;
  }
}

/**
 * 處理聊天請求
 */
export async function chat(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  onStep?: OnStepCallback
): Promise<ChatResponse> {
  const { client, model } = getClient();
  const flowSteps: FlowStep[] = [];
  const totalStart = Date.now();

  // 第一步：檢查是否屬於服務範疇（考慮對話上下文）
  const scopeResult = await trackStep(
    flowSteps,
    'check_scope',
    () => checkScope(userMessage, conversationHistory),
    (r) => r.inScope ? '在範疇內' : `不在範疇：${r.reason || '不相關問題'}`,
    onStep
  );

  if (!scopeResult.inScope) {
    // 記錄跳過的步驟
    pushStep(flowSteps, { node: 'scope_decision', status: 'success', duration: 0, detail: '否' }, onStep);
    pushStep(flowSteps, { node: 'out_of_scope', status: 'success', duration: 0, detail: '回傳提示訊息' }, onStep);

    // 不在服務範疇內，直接回覆（不執行 RAG）
    const outOfScopeResponse = `您好！您的問題「${userMessage}」不在本系統的服務範疇內。

您可以試著問我這些問題：
${SUGGESTED_QUESTIONS.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

    return {
      content: outOfScopeResponse,
      citations: [],
      flowTrace: {
        steps: flowSteps,
        totalDuration: Date.now() - totalStart,
      },
    };
  }

  // 範疇檢查通過
  pushStep(flowSteps, { node: 'scope_decision', status: 'success', duration: 0, detail: '是' }, onStep);
  pushStep(flowSteps, { node: 'parallel_start', status: 'success', duration: 0, detail: '開始並行處理' }, onStep);

  // 在服務範疇內，執行完整 RAG 流程
  // 並行處理：搜尋相關資料 + 產生任務拆解
  const parallelStart = Date.now();

  // 知識缺口門檻
  const KNOWLEDGE_GAP_THRESHOLD = 0.65;

  // 向量化和搜尋
  const ragPromise = (async () => {
    const embedStart = Date.now();
    const context = await buildContext(userMessage, 5);
    const searchResult = await searchForCitationsWithScore(userMessage, 5);

    // 記錄向量搜尋步驟
    pushStep(flowSteps, {
      node: 'embed_query',
      status: 'success',
      duration: 10,
      detail: '向量化完成',
    }, onStep);
    pushStep(flowSteps, {
      node: 'vector_search',
      status: 'success',
      duration: Date.now() - embedStart - 10,
      detail: `${searchResult.resultCount}筆結果`,
      metadata: { maxScore: searchResult.maxScore },
    }, onStep);
    pushStep(flowSteps, {
      node: 'build_context',
      status: 'success',
      duration: 5,
      detail: `上下文長度 ${context.length} 字`,
    }, onStep);

    // 檢查是否有知識缺口
    if (searchResult.resultCount === 0 || searchResult.maxScore < KNOWLEDGE_GAP_THRESHOLD) {
      pushStep(flowSteps, {
        node: 'knowledge_gap',
        status: 'success',
        duration: 0,
        detail: searchResult.resultCount === 0 ? 'no_results' : 'low_relevance',
        metadata: {
          query: userMessage,
          maxScore: searchResult.maxScore,
          resultCount: searchResult.resultCount,
        },
      }, onStep);
    }

    return { context, citations: searchResult.citations, maxScore: searchResult.maxScore };
  })();

  // 任務拆解
  const workflowPromise = trackStep(
    flowSteps,
    'gen_workflow',
    () => generateWorkflow(userMessage),
    (w) => JSON.stringify(w),
    onStep
  );

  const [{ context, citations }, workflow] = await Promise.all([ragPromise, workflowPromise]);

  // 建立訊息
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10), // 只保留最近 10 則對話
    {
      role: "user",
      content: `## 相關資料\n\n${context}\n\n## 用戶問題\n\n${userMessage}`,
    },
  ];

  // 呼叫 LLM
  const llmStart = Date.now();
  const response = await client.chat.completions.create({
    model,
    messages: messages as any,
    temperature: 0.3,
    max_tokens: 2000,
  });
  const content = response.choices[0]?.message?.content || "";
  const tokenCount = response.usage?.completion_tokens || 0;

  pushStep(flowSteps, {
    node: 'llm_call',
    status: 'success',
    duration: Date.now() - llmStart,
    detail: `${tokenCount} tokens`,
  }, onStep);

  // 自我檢核
  const selfCheckResult = await trackStep(
    flowSteps,
    'self_check',
    () => performSelfCheck(userMessage, content, context),
    (r) => r.passed ? '通過' : `未通過：${r.notes}`,
    onStep
  );

  // 如果自我檢核未通過，嘗試重新生成
  if (!selfCheckResult.passed) {
    console.log('[LLM] 自我檢核未通過，嘗試重新生成...');

    // 記錄重試
    pushStep(flowSteps, {
      node: 'retry',
      status: 'success',
      duration: 0,
      detail: '自我檢核未通過，重新搜尋並生成',
    }, onStep);

    // 用更精確的搜尋（增加 topK）
    const retryStart = Date.now();
    const retryContext = await buildContext(userMessage, 10);
    const retrySearchResult = await searchForCitationsWithScore(userMessage, 10);

    pushStep(flowSteps, {
      node: 'vector_search',
      status: 'success',
      duration: Date.now() - retryStart,
      detail: `重新搜尋：${retrySearchResult.resultCount}筆結果`,
      metadata: { maxScore: retrySearchResult.maxScore },
    }, onStep);

    const retryCitations = retrySearchResult.citations;

    // 重新生成，加入更嚴格的提示
    const retryMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT + `\n\n重要提醒：你必須嚴格基於下方提供的參考資料回答。如果參考資料中沒有相關內容，請明確說明「根據目前的資料庫內容，無法提供完整答案」，不要編造。` },
      ...conversationHistory.slice(-10),
      {
        role: "user",
        content: `## 相關資料\n\n${retryContext}\n\n## 用戶問題\n\n${userMessage}`,
      },
    ];

    const retryLlmStart = Date.now();
    const retryResponse = await client.chat.completions.create({
      model,
      messages: retryMessages as any,
      temperature: 0.1, // 降低溫度，更保守
      max_tokens: 2000,
    });
    const retryContent = retryResponse.choices[0]?.message?.content || "";
    const retryTokenCount = retryResponse.usage?.completion_tokens || 0;

    pushStep(flowSteps, {
      node: 'llm_call',
      status: 'success',
      duration: Date.now() - retryLlmStart,
      detail: `重新生成：${retryTokenCount} tokens`,
    }, onStep);

    // 再次自我檢核
    const retryCheckResult = await trackStep(
      flowSteps,
      'self_check',
      () => performSelfCheck(userMessage, retryContent, retryContext),
      (r) => r.passed ? '通過' : `仍未通過：${r.notes}`,
      onStep
    );

    // 如果還是未通過，加上警告訊息
    const finalContent = retryCheckResult.passed
      ? retryContent
      : `⚠️ **注意：以下回答可能不夠完整或準確，建議諮詢專業人員確認。**\n\n${retryContent}\n\n---\n*系統提示：本回答未能完全通過自動檢核，可能原因是知識庫中缺乏相關資料。*`;

    return {
      content: finalContent,
      citations: retryCitations,
      workflow,
      selfCheck: retryCheckResult.passed
        ? retryCheckResult.notes || "內容已驗證與來源文件一致"
        : `⚠️ ${retryCheckResult.notes}`,
      flowTrace: {
        steps: flowSteps,
        totalDuration: Date.now() - totalStart,
      },
    };
  }

  // 自我檢核通過
  return {
    content,
    citations,
    workflow,
    selfCheck: selfCheckResult.notes || "內容已驗證與來源文件一致",
    flowTrace: {
      steps: flowSteps,
      totalDuration: Date.now() - totalStart,
    },
  };
}

/**
 * 自我檢核
 */
async function performSelfCheck(
  question: string,
  answer: string,
  context: string
): Promise<{ passed: boolean; notes: string }> {
  const { client, model } = getClient();

  const checkPrompt = `請檢查以下回答是否正確且有依據：

## 問題
${question}

## 回答
${answer}

## 參考資料
${context}

## 檢核項目
1. 回答是否基於提供的參考資料？
2. 是否有編造或猜測的內容？
3. 引用是否正確？

請用 JSON 格式回覆：
{"passed": true/false, "notes": "檢核說明"}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: checkPrompt }],
      temperature: 0,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Self-check error:", error);
  }

  return { passed: true, notes: "自動檢核完成" };
}

/**
 * 串流聊天
 */
export async function chatStream(
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  onChunk: (chunk: string) => void
): Promise<ChatResponse> {
  const { client, model } = getClient();

  // 搜尋相關資料
  const [context, searchResult] = await Promise.all([
    buildContext(userMessage, 5),
    searchForCitationsWithScore(userMessage, 5),
  ]);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10),
    {
      role: "user",
      content: `## 相關資料\n\n${context}\n\n## 用戶問題\n\n${userMessage}`,
    },
  ];

  const stream = await client.chat.completions.create({
    model,
    messages: messages as any,
    temperature: 0.3,
    max_tokens: 2000,
    stream: true,
  });

  let fullContent = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    fullContent += content;
    onChunk(content);
  }

  return {
    content: fullContent,
    citations: searchResult.citations,
  };
}
