import { GoogleGenAI } from "@google/genai";
import { ChatMessageInput, RetryableLlmError, isRetryableStatus, StreamResult } from "./types";

const MODEL = "gemini-3.5-flash";

export async function streamFromGemini(
  messages: ChatMessageInput[]
): Promise<StreamResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const client = new GoogleGenAI({ apiKey });

  // Gemini takes a single systemInstruction string, not a list of
  // system-role messages the way Groq/OpenRouter do — so every
  // system message (repo context, code context, any future ones)
  // needs to be combined, not just the first one picked.
  const systemMessages = messages.filter((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  try {
    const response = await client.models.generateContentStream({
      model: MODEL,
      contents: conversation.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      config: systemMessages.length
        ? { systemInstruction: systemMessages.map((m) => m.content).join("\n\n") }
        : undefined,
    });

    async function* toTextStream() {
      for await (const chunk of response) {
        const text = chunk.text;
        if (text) yield text;
      }
    }

    return { provider: "gemini", model: MODEL, stream: toTextStream() };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (isRetryableStatus(status)) {
      throw new RetryableLlmError("gemini", status, `Gemini failed: ${String(err)}`);
    }
    throw err;
  }
}