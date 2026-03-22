/**
 * 文件切分模組
 */

export interface Chunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    section?: string;
    index: number;
    [key: string]: unknown;
  };
}

export interface ChunkOptions {
  maxTokens?: number; // 每個 chunk 的最大 token 數
  overlap?: number; // 重疊的 token 數
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxTokens: 500,
  overlap: 50,
};

/**
 * 簡易 token 計算 (中文約 1 字 = 2 tokens, 英文約 4 字母 = 1 token)
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 2 + otherChars / 4);
}

/**
 * 將文字切分為 chunks
 */
export function chunkText(
  text: string,
  source: string,
  options: ChunkOptions = {}
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  // 先按段落分割
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // 如果單一段落就超過限制，需要再切分
    if (paragraphTokens > opts.maxTokens) {
      // 先儲存目前的 chunk
      if (currentChunk) {
        chunks.push({
          id: `${source}-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            source,
            index: chunkIndex,
          },
        });
        chunkIndex++;
        currentChunk = "";
      }

      // 按句子切分長段落
      const sentences = paragraph.split(/(?<=[。！？\n])/);
      for (const sentence of sentences) {
        if (
          estimateTokens(currentChunk + sentence) > opts.maxTokens &&
          currentChunk
        ) {
          chunks.push({
            id: `${source}-${chunkIndex}`,
            content: currentChunk.trim(),
            metadata: {
              source,
              index: chunkIndex,
            },
          });
          chunkIndex++;
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
    } else if (
      estimateTokens(currentChunk + "\n\n" + paragraph) > opts.maxTokens
    ) {
      // 加上這個段落會超過限制，先儲存目前的
      if (currentChunk) {
        chunks.push({
          id: `${source}-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            source,
            index: chunkIndex,
          },
        });
        chunkIndex++;
      }
      currentChunk = paragraph;
    } else {
      // 可以繼續累加
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    }
  }

  // 儲存最後一個 chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `${source}-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        source,
        index: chunkIndex,
      },
    });
  }

  return chunks;
}
