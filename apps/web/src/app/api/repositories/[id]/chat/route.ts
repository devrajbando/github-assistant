import { prisma } from "database/client";
import { auth } from "@/auth";
import { streamChatCompletion, buildRepoContextMessage, ChatMessageInput } from "@/lib/llm";
import { getOrCreateChatSession, getChatMessages, saveChatMessage } from "@/lib/chat-session";

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

  const messages: ChatMessageInput[] = [
    contextMessage,
    ...history.map((m) => ({
      role: m.role as ChatMessageInput["role"],
      content: m.content,
    })),
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