import { streamChatCompletion, buildRepoContextMessage } from "@/lib/llm";

export async function GET(request: Request) {
  const repositoryId = new URL(request.url).searchParams.get("repositoryId");
  if (!repositoryId) {
    return Response.json({ error: "repositoryId query param required" }, { status: 400 });
  }

  const contextMessage = await buildRepoContextMessage(repositoryId);

  const { provider, model, stream } = await streamChatCompletion([
    contextMessage,
    { role: "user", content: "What is this repository, and what's the most recently active pull request?" },
  ]);

  let fullText = "";
  for await (const chunk of stream) {
    fullText += chunk;
  }

  return Response.json({ provider, model, contextMessage, response: fullText });
}