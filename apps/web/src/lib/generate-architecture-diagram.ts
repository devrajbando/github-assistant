import { prisma } from "database/client";
import { searchRepository } from "./search-repository";
import { streamChatCompletion, ChatMessageInput } from "./llm";

interface ParsedDiagram {
  summary: string;
  mermaidCode: string;
}

interface RepresentativeChunk {
  filePath: string;
  content: string;
}

// Fixed "architecture-shaped" queries run against the same vector
// search used everywhere else (searchRepository) — this isn't
// answering one question, it's trying to sample broadly across the
// kinds of code that make up a system's shape. Results are merged
// and deduped by file, capped at MAX_DISTINCT_FILES to bound prompt
// size regardless of repo size.
const ARCHITECTURE_QUERIES = [
  "project entry point and application startup",
  "core business logic and domain models",
  "API routes and request handling",
  "database schema and data access layer",
  "external service integrations and third-party APIs",
  "authentication and authorization",
  "background jobs, workers, or async processing",
  "frontend components and UI structure",
];

const RESULTS_PER_QUERY = 3;
const MAX_DISTINCT_FILES = 24;

async function gatherRepresentativeChunks(repositoryId: string): Promise<RepresentativeChunk[]> {
  const seen = new Map<string, RepresentativeChunk>();

  for (const query of ARCHITECTURE_QUERIES) {
    const results = await searchRepository(repositoryId, query, RESULTS_PER_QUERY);
    for (const r of results) {
      if (!seen.has(r.filePath)) {
        seen.set(r.filePath, { filePath: r.filePath, content: r.content });
      }
    }
    if (seen.size >= MAX_DISTINCT_FILES) break;
  }

  return Array.from(seen.values()).slice(0, MAX_DISTINCT_FILES);
}

function buildDiagramPrompt(repositoryFullName: string, chunks: RepresentativeChunk[]): ChatMessageInput[] {
  const codeText = chunks.map((c) => `--- ${c.filePath} ---\n${c.content}`).join("\n\n");

  const system: ChatMessageInput = {
    role: "system",
    content: `You are a senior software architect producing a HIGH-LEVEL architecture diagram for the repository "${repositoryFullName}", based only on the code snippets provided below.

Respond with ONLY a single JSON object, no markdown code fences, no other text, matching exactly this shape:
{
  "summary": "2-4 sentence plain-English overview of the architecture",
  "mermaidCode": "a valid Mermaid diagram definition, as a single string (use \\n for line breaks), starting with 'flowchart TD' or 'graph TD'"
}

Rules:
- Base the diagram ONLY on what these snippets actually show. Do not invent modules, services, or components that aren't evidenced here.
- Keep it HIGH-LEVEL: major components/layers/modules and how they connect (e.g. "API routes" --> "database", "chat route" --> "LLM provider"), not individual functions or files.
- If the snippets don't give enough coverage to diagram a whole system confidently, produce a smaller, honest diagram of just what's evidenced, and say so in the summary rather than padding it out.
- Use short, clear node labels. Prefer fewer, well-chosen nodes over an exhaustive one — this is a map, not a blueprint.`,
  };

  const user: ChatMessageInput = {
    role: "user",
    content: `Code snippets sampled from across the repository:\n\n${codeText}`,
  };

  return [system, user];
}

function parseDiagramResponse(raw: string): ParsedDiagram {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.summary !== "string" || typeof parsed.mermaidCode !== "string") {
    throw new Error("LLM response did not match expected diagram shape");
  }

  return parsed as ParsedDiagram;
}

/**
 * Known limitation, not solved: gatherRepresentativeChunks makes several
 * sequential searchRepository calls, each independently re-resolving the
 * repo's current activeIndexRunId. If a re-index completes mid-generation
 * (multi-minute window, see index-repository.ts), later queries in this
 * same call could theoretically pull from a newer generation than earlier
 * ones. Not worth engineering around pre-emptively — same judgment call
 * as the no-diff-truncation limitation already accepted in code-review.ts.
 */
export async function generateArchitectureDiagram(repositoryId: string) {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }
  if (!repository.activeIndexRunId) {
    throw new Error("Repository has not been indexed yet");
  }

  const diagram = await prisma.architectureDiagram.create({
    data: {
      repositoryId,
      status: "pending",
      sourceIndexRunId: repository.activeIndexRunId,
    },
  });

  try {
    const chunks = await gatherRepresentativeChunks(repositoryId);
    if (chunks.length === 0) {
      throw new Error("No indexed code found to diagram");
    }

    const messages = buildDiagramPrompt(repository.fullName, chunks);
    const { provider, model, stream } = await streamChatCompletion(messages);

    let fullText = "";
    for await (const chunk of stream) {
      fullText += chunk;
    }

    const parsed = parseDiagramResponse(fullText);

    return prisma.architectureDiagram.update({
      where: { id: diagram.id },
      data: {
        status: "completed",
        summary: parsed.summary,
        mermaidCode: parsed.mermaidCode,
        provider,
        model,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    return prisma.architectureDiagram.update({
      where: { id: diagram.id },
      data: {
        status: "failed",
        errorMessage: String(err instanceof Error ? err.message : err),
        completedAt: new Date(),
      },
    });
  }
}