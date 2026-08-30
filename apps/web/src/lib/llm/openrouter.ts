import OpenAI from "openai";
import { ChatMessageInput, RetryableLlmError, isRetryableStatus, StreamResult } from "./types";

const MODEL = "meta-llama/llama-3.1-8b-instruct:free";

export async function streamFromOpenRouter(
  messages: ChatMessageInput[]
): Promise<StreamResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    async function* toTextStream() {
      for await (const chunk of response) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    }

    return { provider: "openrouter", model: MODEL, stream: toTextStream() };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (isRetryableStatus(status)) {
      throw new RetryableLlmError("openrouter", status, `OpenRouter failed: ${String(err)}`);
    }
    throw err;
  }
}