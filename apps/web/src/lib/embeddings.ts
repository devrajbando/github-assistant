import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("429") || message.includes("RESOURCE_EXHAUSTED");
}

/**
 * Embeds a batch of texts using Gemini's embedding model.
 * taskType matters: RETRIEVAL_DOCUMENT for content being indexed,
 * RETRIEVAL_QUERY for a search query at retrieval time — these
 * produce embeddings optimized differently for each side of a
 * similarity search, not just a labeling nicety.
 *
 * Retries with exponential backoff on 429s. No cross-provider
 * fallback here (unlike chat) — checked Groq's actual available
 * models directly and confirmed no embedding model exists on this
 * account, despite some docs suggesting otherwise. Gemini-only,
 * relying on retry + the throttling in index-repository.ts instead.
 */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const client = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: MODEL,
        contents: texts,
        config: { outputDimensionality: DIMENSIONS, taskType },
      });

      if (!response.embeddings || response.embeddings.length !== texts.length) {
        throw new Error(
          `Expected ${texts.length} embeddings back, got ${response.embeddings?.length ?? 0}`
        );
      }

      return response.embeddings.map((e) => {
        if (!e.values) throw new Error("Embedding response missing values");
        return e.values;
      });
    } catch (err) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unreachable: retry loop exited without returning or throwing");
}