/**
 * OpenAI Embedding 模組
 * 支援 OpenAI 官方 API 和 Azure OpenAI
 *
 * 優先使用 OpenAI 官方 API，如果沒有設定則嘗試 Azure OpenAI
 * 如果都沒有設定，會使用假資料（用於測試）
 */

import OpenAI, { AzureOpenAI } from "openai";

const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small 的維度

let client: OpenAI | AzureOpenAI | null = null;
let useFakeEmbedding = false;
let embeddingModel = "text-embedding-3-small";

function getClient(): OpenAI | AzureOpenAI | null {
  if (useFakeEmbedding) {
    return null;
  }

  if (!client) {
    // 優先使用 OpenAI 官方 API
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey !== "your-openai-api-key") {
      console.log("[Embedder] 使用 OpenAI 官方 API");
      client = new OpenAI({
        apiKey: openaiKey,
      });
      embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
      return client;
    }

    // 其次使用 Azure OpenAI
    const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const azureKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-01";

    if (azureEndpoint && azureKey && azureKey !== "your-azure-api-key") {
      console.log("[Embedder] 使用 Azure OpenAI");
      client = new AzureOpenAI({
        endpoint: azureEndpoint,
        apiKey: azureKey,
        apiVersion,
      });
      embeddingModel = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding-3-small";
      return client;
    }

    // 都沒有設定，使用假資料模式
    console.log("[Embedder] 未設定 API Key，使用假資料模式");
    useFakeEmbedding = true;
    return null;
  }
  return client;
}

/**
 * 產生假的 embedding 向量（用於測試）
 * 基於文字內容產生偽隨機向量，相同文字會產生相同向量
 */
function generateFakeEmbedding(text: string): number[] {
  const vector: number[] = [];
  let seed = 0;

  // 基於文字產生 seed
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) & 0xffffffff;
  }

  // 產生偽隨機向量
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    vector.push((seed / 0x7fffffff) * 2 - 1); // -1 到 1 之間
  }

  // 正規化
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

/**
 * 將文字轉換為向量
 */
export async function embed(text: string): Promise<number[]> {
  const client = getClient();

  if (!client) {
    return generateFakeEmbedding(text);
  }

  const response = await client.embeddings.create({
    input: text,
    model: embeddingModel,
  });

  return response.data[0].embedding;
}

/**
 * 批次將多個文字轉換為向量
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const client = getClient();

  if (!client) {
    console.log(`[Embedder] 使用假資料產生 ${texts.length} 個向量`);
    return texts.map((text) => generateFakeEmbedding(text));
  }

  // OpenAI 有批次大小限制，分批處理
  const BATCH_SIZE = 16;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      input: batch,
      model: embeddingModel,
    });

    for (const item of response.data) {
      results.push(item.embedding);
    }
  }

  return results;
}
