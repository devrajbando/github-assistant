import { prisma } from "database/client";
import { auth } from "@/auth";
import { streamChatCompletion, buildRepoContextMessage, ChatMessageInput } from "@/lib/llm";
import { searchRepository, formatCodeContextMessage } from "@/lib/search-repository";
import { getOrCreateChatSession, getChatMessages, saveChatMessage } from "@/lib/chat-session";

// Kept smaller than the standalone search UI's default (8) — this
// count was what the RAG feature was originally verified against,
// and every extra chunk here is prompt budget shared with the full
// chat history, not just a search results list.
const CHAT_CODE_CONTEXT_LIMIT = 5;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { message } = await request.json();
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const chatSession = await getOrCreateChatSession(session.user.id, repositoryId);
  const history = await getChatMessages(chatSession.id);

  await saveChatMessage({
    chatSessionId: chatSession.id,
    role: "user",
    content: message,
  });

  const contextMessage = await buildRepoContextMessage(repositoryId);

  let codeContextMessage: ChatMessageInput | null = null;
  try {
    const results = await searchRepository(repositoryId, message, CHAT_CODE_CONTEXT_LIMIT);
    codeContextMessage = formatCodeContextMessage(results);
  } catch (err) {
    // A RAG failure (not indexed yet, network blip, exhausted
    // retries, whatever) should degrade to "answer without code
    // context," not take down the whole chat turn — the user still
    // gets a real answer grounded in repo/PR/issue context, just not
    // augmented with retrieved code.
    console.error("searchRepository failed, continuing without code context:", err);
  }

  // Code context goes LAST, immediately before the current question
  // — not near the top of the array. LLMs weight later context more
  // heavily, and burying it before a long, growing chat history (which
  // can include the model's own earlier "I don't have code access"
  // replies) is what caused this exact context to get ignored before.
  const messages: ChatMessageInput[] = [
    contextMessage,
    ...history.map((m) => ({
      role: m.role as ChatMessageInput["role"],
      content: m.content,
    })),
    ...(codeContextMessage ? [codeContextMessage] : []),
    { role: "user", content: message },
  ];

  const { provider, model, stream } = await streamChatCompletion(messages);

  let fullText = "";
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        await saveChatMessage({
          chatSessionId: chatSession.id,
          role: "assistant",
          content: fullText,
          provider,
          model,
        });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}