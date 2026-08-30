export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessageInput {
  role: ChatRole;
  content: string;
}

export type LlmProvider = "gemini" | "groq" | "openrouter";

export interface StreamResult {
  provider: LlmProvider;
  model: string;
  stream: AsyncIterable<string>;
}

/**
 * Thrown by provider adapters to signal a retryable failure
 * (rate limit or server error) — the orchestrator catches ONLY this
 * error type to decide whether to fall back to the next provider.
 * Any other error (bad request, auth failure, etc.) propagates
 * immediately without retrying against a different provider.
 */
export class RetryableLlmError extends Error {
  constructor(
    public provider: LlmProvider,
    public statusCode: number | undefined,
    message: string
  ) {
    super(message);
    this.name = "RetryableLlmError";
  }
}

export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return false;
  return status === 429 || (status >= 500 && status < 600);
}