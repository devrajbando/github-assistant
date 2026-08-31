import { prisma } from "database/client";
import { toSql } from "pgvector";
import { embedTexts } from "./embeddings";
import type { ChatMessageInput } from "./llm";

export interface SearchResult {
  filePath: string;
  content: string;
  distance: number;
}

const DEFAULT_LIMIT = 8;

/**
 * Embeds `query` with RETRIEVAL_QUERY (asymmetric from the
 * RETRIEVAL_DOCUMENT task type used when chunks were indexed —
 * Gemini's embedding model is trained to treat these differently)
 * and returns the closest chunks by cosine distance.
 *
 * Scoped to activeIndexRunId, not just repositoryId — during a
 * re-index, code_chunks briefly holds both the last fully-completed
 * generation AND a partially-inserted new one (see runIndexJob in
 * index-repository.ts). Filtering to activeIndexRunId guarantees
 * results only ever come from a generation that finished
 * successfully, never a half-written one mid-run.
 */
export async function searchRepository(
  repositoryId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { activeIndexRunId: true },
  });

  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }

  // Gated on activeIndexRunId alone, not indexStatus. A repo mid
  // re-index (INDEXING) or with a failed re-index attempt (FAILED)
  // can still have a valid, fully-completed prior generation of
  // chunks — runIndexJob in index-repository.ts deliberately leaves
  // that generation untouched and queryable for the entire duration
  // of a new run, and only swaps it out on success. Requiring
  // indexStatus === "INDEXED" here would refuse to serve that still-
  // good data during exactly the window it's most useful (a re-index
  // is often triggered by fresh commits, so the old index remains
  // the best available answer until the new one finishes).
  if (!repository.activeIndexRunId) {
    throw new Error("Repository has not been indexed yet");
  }

  const [queryEmbedding] = await embedTexts([query], "RETRIEVAL_QUERY");
  const vector = toSql(queryEmbedding);

  const results = await prisma.$queryRaw<
    { file_path: string; content: string; distance: number }[]
  >`
    SELECT
      file_path,
      content,
      embedding <=> ${vector}::vector AS distance
    FROM code_chunks
    WHERE repository_id = ${repositoryId}
      AND index_run_id = ${repository.activeIndexRunId}
    ORDER BY distance
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    filePath: r.file_path,
    content: r.content,
    distance: r.distance,
  }));
}

/**
 * Formats search results into a system-role message for chat, or
 * null if there's nothing to show — an empty/missing section is
 * better than a "here are relevant code snippets:" header with
 * nothing under it, which would read as "this repo genuinely has no
 * matching code" when really there's just nothing indexed (or the
 * search found nothing close enough).
 */
export function formatCodeContextMessage(results: SearchResult[]): ChatMessageInput | null {
  if (results.length === 0) return null;

  const content = results
    .map((r) => `--- ${r.filePath} ---\n${r.content}`)
    .join("\n\n");

  return {
    role: "system",
    content: `The following code snippets were retrieved via semantic search over this repository's actual source code and ARE directly relevant to the user's question. Use them as your primary, authoritative source for any question about how the code is implemented — quote or describe the real logic shown here rather than describing how a typical/generic implementation might work. Only fall back to general knowledge if these snippets genuinely don't cover what's being asked.\n\n${content}`,
  };
}