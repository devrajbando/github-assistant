import {  prisma } from "database/client";
import { LlmProvider } from "./llm";

/**
 * Returns the most recent ChatSession for this user+repository,
 * creating one if none exists yet. One active session per repo per
 * user for now — the schema supports multiple named conversations,
 * but a session-switcher UI is deliberately not built yet.
 */
export interface MessageSource {
  id: string;
  filePath: string;
  content: string;
}

export async function getOrCreateChatSession(userId: string, repositoryId: string) {
  const existing = await prisma.chatSession.findFirst({
    where: { userId, repositoryId },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.chatSession.create({
    data: { userId, repositoryId },
  });
}

export async function getChatMessages(chatSessionId: string) {
  return prisma.chatMessage.findMany({
    where: { chatSessionId },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveChatMessage(params: {
  chatSessionId: string;
  role: "user" | "assistant";
  content: string;
  provider?: LlmProvider;
  model?: string;
  sources?: MessageSource[];
}) {
  return prisma.chatMessage.create({
    data: {
      chatSessionId: params.chatSessionId,
      role: params.role,
      content: params.content,
      provider: params.provider ?? null,
      model: params.model ?? null,
      sources: params.sources ?? undefined,
    },
  });
}