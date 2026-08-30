import { streamFromGemini } from "./gemini";
import { streamFromGroq } from "./groq";
import { streamFromOpenRouter } from "./openrouter";
import { ChatMessageInput, RetryableLlmError, StreamResult } from "./types";

export * from "./types";
export * from "./context";

const PROVIDER_CHAIN = [streamFromGemini, streamFromGroq, streamFromOpenRouter];

/**
 * Tries each provider in priority order (Gemini → Groq → OpenRouter).
 * Only falls through to the next provider on a RetryableLlmError
 * (429/5xx) — any other error (bad request, missing API key, etc.)
 * propagates immediately, since retrying against a different
 * provider wouldn't fix a problem with our own request.
 */
export async function streamChatCompletion(
  messages: ChatMessageInput[]
): Promise<StreamResult> {
  let lastError: unknown;

  for (const providerFn of PROVIDER_CHAIN) {
    try {
      return await providerFn(messages);
    } catch (err) {
      if (err instanceof RetryableLlmError) {
        lastError = err;
        continue; // try the next provider in the chain
      }
      throw err; // non-retryable — surface immediately, don't fall back
    }
  }

  throw new Error(
    `All LLM providers failed. Last error: ${String(lastError)}`
  );
}