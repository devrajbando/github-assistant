import Groq from "groq-sdk";
import { ChatMessageInput, RetryableLlmError, isRetryableStatus, StreamResult } from "./types";

const MODEL = "llama-3.3-70b-versatile";

export async function streamFromGroq(
  messages: ChatMessageInput[]
): Promise<StreamResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const client = new Groq({ apiKey });

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

    return { provider: "groq", model: MODEL, stream: toTextStream() };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (isRetryableStatus(status)) {
      throw new RetryableLlmError("groq", status, `Groq failed: ${String(err)}`);
    }
    throw err;
  }
}