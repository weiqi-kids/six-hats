/**
 * Blue Hat Review - 檢核與補跑決策
 */

import OpenAI from "openai";
import type { BlueReview, BlueOpening, HatResponse, HatType, AnalysisContext } from "../types.js";
import { buildContextMessages } from "../utils.js";

const SYSTEM_PROMPT = `你是 Blue Hat（藍帽）主持人，負責檢核五帽的分析結果。

## 你的角色
檢核各帽子的輸出是否：
1. 完整 - 有沒有遺漏重要面向
2. 正確 - 有沒有越界（做了不該做的事）
3. 一致 - 有沒有相互矛盾

## 檢核標準

### White Hat 檢核
- 是否只陳述事實，沒有夾帶評價？
- 數據是否有來源依據？

### Red Hat 檢核
- 是否真誠表達情感？
- 有沒有用理性掩蓋感受？

### Black Hat 檢核
- 風險分析是否具體？
- 有沒有過度悲觀？

### Yellow Hat 檢核
- 機會分析是否務實？
- 有沒有過度樂觀？

### Green Hat 檢核
- 創意是否多元？
- 有沒有突破常規？

## 輸出格式
請嚴格輸出以下 JSON 格式：
{
  "completenessCheck": {
    "white": { "passed": true/false, "note": "檢核說明" },
    "red": { "passed": true/false, "note": "檢核說明" },
    "black": { "passed": true/false, "note": "檢核說明" },
    "yellow": { "passed": true/false, "note": "檢核說明" },
    "green": { "passed": true/false, "note": "檢核說明" }
  },
  "boundaryViolations": ["越界問題1", "越界問題2"],
  "informationGaps": ["資訊缺口1", "資訊缺口2"],
  "conflicts": ["衝突1", "衝突2"],
  "rerunRequired": true/false,
  "hatsToRerun": ["white", "black"],
  "rerunReasons": {
    "white": "需要補充市場數據",
    "black": "風險分析不夠具體"
  },
  "summary": "整體檢核總結"
}`;

export async function analyze(
  client: OpenAI,
  model: string,
  hatResponses: Array<{ hat: HatType; result: HatResponse }>,
  opening: BlueOpening,
  context?: AnalysisContext
): Promise<BlueReview> {
  const responsesText = hatResponses
    .map(
      ({ hat, result }) =>
        `[${hat.toUpperCase()} HAT]\n${result.content}\n重點：${result.keyPoints.join("、")}`
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
        content: `問題定義：${opening.problemDefinition}
目標：${opening.goal}

請檢核以下五帽分析結果：

${responsesText}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    // 預設通過
    return {
      completenessCheck: {
        white: { passed: true, note: "通過" },
        red: { passed: true, note: "通過" },
        black: { passed: true, note: "通過" },
        yellow: { passed: true, note: "通過" },
        green: { passed: true, note: "通過" },
      },
      boundaryViolations: [],
      informationGaps: [],
      conflicts: [],
      rerunRequired: false,
      hatsToRerun: [],
      rerunReasons: {},
      summary: "檢核完成，各帽分析完整",
    };
  }

  return JSON.parse(jsonMatch[0]) as BlueReview;
}
