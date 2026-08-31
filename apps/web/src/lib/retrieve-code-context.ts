import { prisma } from "database/client";
import { toSql } from "pgvector";
import { embedTexts } from "./embeddings";
import { ChatMessageInput } from "./llm";

const TOP_K = 5;

interface RetrievedChunk {
  file_path: string;
  content: string;
}

/**
 * Embeds the user's question (RETRIEVAL_QUERY, matching the
 * RETRIEVAL_DOCUMENT taskType used when the chunks were indexed —
 * these are optimized for opposite ends of a similarity search) and
 * returns the TOP_K nearest code chunks by cosine distance.
 *
 * pgvector's `<=>` operator is cosine distance (0 = identical
 * direction), so ORDER BY ... ASC gives nearest-first.
 */
export async function retrieveCodeContext(
  repositoryId: string,
  question: string
): Promise<RetrievedChunk[]> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { activeIndexRunId: true },
  });

  // Not indexed yet, or the only attempt so far failed — nothing to
  // search. This is also what guarantees results never mix rows
  // from an in-progress or failed run: we only ever query the
  // specific runId the Repository row says is active.
  if (!repository?.activeIndexRunId) {
    return [];
  }

  const [queryEmbedding] = await embedTexts([question], "RETRIEVAL_QUERY");

  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT file_path, content
    FROM code_chunks
    WHERE repository_id = ${repositoryId} AND index_run_id = ${repository.activeIndexRunId}
    ORDER BY embedding <=> ${toSql(queryEmbedding)}::vector
    LIMIT ${TOP_K}
  `;
}

/**
 * Formats retrieved chunks into a system-role message, or returns
 * null if the repo hasn't been indexed yet — an empty/missing
 * section is better than sending an empty "here are relevant code
 * snippets:" header that would look like the repo genuinely has no
 * matching code, when really it just hasn't been indexed.
 */
export function formatCodeContextMessage(chunks: RetrievedChunk[]): ChatMessageInput | null {
  if (chunks.length === 0) return null;

  const content = chunks
    .map((c) => `--- ${c.file_path} ---\n${c.content}`)
    .join("\n\n");

  return {
    role: "system",
    content: `The following code snippets were retrieved via semantic search over this repository's actual source code and ARE directly relevant to the user's question. Use them as your primary, authoritative source for any question about how the code is implemented — quote or describe the real logic shown here rather than describing how a typical/generic implementation might work. Only fall back to general knowledge if these snippets genuinely don't cover what's being asked.\n\n${content}`,
  };
}