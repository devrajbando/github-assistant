import { prisma } from "database/client";
import { toSql } from "pgvector";
import { createGitHubClient } from "./github";
import { embedTexts } from "./embeddings";

export type IndexStatus = "NOT_INDEXED" | "INDEXING" | "INDEXED" | "FAILED";

const ALLOWED_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "c", "cpp", "h", "hpp",
  "cs", "rb", "php", "swift", "kt", "md", "css", "scss", "html", "sql", "sh",
  "yaml", "yml", "toml",
]);

const EXCLUDED_PATH_SUBSTRINGS = ["node_modules/", "dist/", "build/", ".next/", "generated/", "/.git/"];
const EXCLUDED_FILENAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]);

const MAX_FILE_SIZE_BYTES = 200_000;
const CHUNK_LINES = 60;
const CHUNK_OVERLAP_LINES = 10;
const EMBED_BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 15000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RawChunk {
  filePath: string;
  content: string;
}

function shouldIndexFile(path: string, size: number | undefined): boolean {
  if (size !== undefined && size > MAX_FILE_SIZE_BYTES) return false;
  const filename = path.split("/").pop() ?? "";
  if (EXCLUDED_FILENAMES.has(filename)) return false;
  if (EXCLUDED_PATH_SUBSTRINGS.some((s) => path.includes(s))) return false;
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  return ALLOWED_EXTENSIONS.has(ext);
}

function chunkFile(filePath: string, content: string): RawChunk[] {
  const lines = content.split("\n");
  const chunks: RawChunk[] = [];

  for (let start = 0; start < lines.length; start += CHUNK_LINES - CHUNK_OVERLAP_LINES) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    const chunkContent = lines.slice(start, end).join("\n");
    if (chunkContent.trim()) {
      chunks.push({ filePath, content: chunkContent });
    }
    if (end === lines.length) break;
  }

  return chunks;
}

/**
 * Kicks off indexing in the background and returns immediately —
 * does NOT await the actual work. A real repo can take many
 * minutes to embed (batches of 5, 15s apart to respect Gemini's
 * rate limit), far longer than any HTTP request should stay open.
 *
 * This relies on the Node process staying alive after the response
 * is sent, which holds on a long-running server (Docker/self-hosted,
 * your current setup) but would NOT hold on serverless — the
 * function would terminate right after the response flushes,
 * killing the un-awaited work mid-run. Revisit with Next's after()
 * API if this ever moves to Vercel.
 */
export async function startRepositoryIndexing(repositoryId: string): Promise<void> {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }
  if (repository.indexStatus === "INDEXING") {
    throw new Error("Indexing already in progress for this repository");
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { indexStatus: "INDEXING", lastIndexError: null },
  });

  runIndexJob(repositoryId).catch((err) => {
    console.error(`Indexing failed for repository ${repositoryId}:`, err);
  });
}

/**
 * Does the actual fetch/chunk/embed/insert work, tagged with a
 * fresh runId. Never touches the previous generation of chunks
 * while running — they stay untouched and fully queryable for the
 * entire duration of this run, however long it takes.
 *
 * On success: atomically swaps to the new generation and drops the
 * old one, in a single fast transaction (this is just the swap,
 * not the slow embedding work).
 *
 * On failure: cleans up only this run's partial rows. Whatever
 * generation was active before (if any) was never touched, so
 * retrieval keeps serving it — chat degrades to "answering from
 * the last successful index" instead of "answering from nothing."
 */
async function runIndexJob(repositoryId: string): Promise<{ fileCount: number; chunkCount: number; skippedFileCount: number }> {
  const runId = crypto.randomUUID();

  try {
    const repository = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });

    const account = await prisma.account.findFirst({
      where: { userId: repository.userId, provider: "github" },
    });
    if (!account?.access_token) {
      throw new Error(`No GitHub account/token found for user ${repository.userId}`);
    }

    const octokit = createGitHubClient(account.access_token);

    const { data: tree } = await octokit.rest.git.getTree({
      owner: repository.owner,
      repo: repository.name,
      tree_sha: repository.defaultBranch,
      recursive: "true",
    });

    const candidateFiles = (tree.tree ?? []).filter(
      (item) => item.type === "blob" && item.path && shouldIndexFile(item.path, item.size)
    );

    const allChunks: RawChunk[] = [];
    const skippedBinaryFiles: string[] = [];

    for (const file of candidateFiles) {
      const { data: blob } = await octokit.rest.git.getBlob({
        owner: repository.owner,
        repo: repository.name,
        file_sha: file.sha!,
      });
      const content = Buffer.from(blob.content, "base64").toString("utf-8");

      // Passing the extension allowlist doesn't guarantee a file is
      // actually text — a binary file with a text-like extension (or one
      // with a genuinely broken encoding) still decodes to a "string"
      // that can contain null bytes. Postgres text columns reject those
      // outright (error 22021: invalid byte sequence for encoding
      // "UTF8": 0x00), which previously took down the ENTIRE indexing
      // run over a single bad file. Skip it instead — the whole repo's
      // index shouldn't be lost over one unreadable file.
      if (content.includes("\u0000")) {
        skippedBinaryFiles.push(file.path!);
        continue;
      }

      allChunks.push(...chunkFile(file.path!, content));
    }

    if (skippedBinaryFiles.length > 0) {
      console.warn(
        `Skipped ${skippedBinaryFiles.length} file(s) that decoded with null bytes (likely binary) while indexing repository ${repositoryId}:`,
        skippedBinaryFiles
      );
    }

    for (let i = 0; i < allChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + EMBED_BATCH_SIZE);
      const embeddings = await embedTexts(
        batch.map((c) => c.content),
        "RETRIEVAL_DOCUMENT"
      );

      for (let j = 0; j < batch.length; j++) {
        const id = crypto.randomUUID();
        await prisma.$executeRaw`
          INSERT INTO code_chunks (id, repository_id, index_run_id, file_path, content, embedding, created_at)
          VALUES (${id}, ${repositoryId}, ${runId}, ${batch[j].filePath}, ${batch[j].content}, ${toSql(embeddings[j])}::vector, now())
        `;
      }

      if (i + EMBED_BATCH_SIZE < allChunks.length) {
        await sleep(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    await prisma.$transaction([
      prisma.$executeRaw`
        DELETE FROM code_chunks
        WHERE repository_id = ${repositoryId} AND index_run_id != ${runId}
      `,
      prisma.repository.update({
        where: { id: repositoryId },
        data: {
          indexStatus: "INDEXED",
          activeIndexRunId: runId,
          lastIndexedAt: new Date(),
          lastIndexError: null,
        },
      }),
    ]);

    return { fileCount: candidateFiles.length, chunkCount: allChunks.length, skippedFileCount: skippedBinaryFiles.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.$executeRaw`
      DELETE FROM code_chunks WHERE repository_id = ${repositoryId} AND index_run_id = ${runId}
    `;
    await prisma.repository.update({
      where: { id: repositoryId },
      data: { indexStatus: "FAILED", lastIndexError: message },
    });

    throw err;
  }
}