/**
 * LLMs are asked to return raw JSON but sometimes wrap it in a
 * markdown code fence anyway (```json ... ``` or plain ```). Strip
 * that defensively before parsing rather than trusting the prompt
 * instruction to be followed every time.
 */
export function parseJsonLlmResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `LLM returned invalid JSON: ${cleaned.slice(0, 200)}${cleaned.length > 200 ? "…" : ""}`
    );
  }
}