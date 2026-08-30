import { prisma } from "database/client";
import { createGitHubClient } from "./github";
import { streamChatCompletion, ChatMessageInput } from "./llm";

interface ParsedReview {
  summary: string;
  findings: Array<{
    filePath: string;
    lineNumber: number | null;
    severity: "info" | "warning" | "critical";
    comment: string;
  }>;
}

async function fetchPullRequestDiff(pullRequestId: string) {
  const pullRequest = await prisma.pullRequest.findUnique({
    where: { id: pullRequestId },
    include: { repository: true },
  });

  if (!pullRequest) {
    throw new Error(`PullRequest ${pullRequestId} not found`);
  }

  const account = await prisma.account.findFirst({
    where: { userId: pullRequest.repository.userId, provider: "github" },
  });

  if (!account?.access_token) {
    throw new Error(`No GitHub account/token found for user ${pullRequest.repository.userId}`);
  }

  const octokit = createGitHubClient(account.access_token);

  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: pullRequest.repository.owner,
    repo: pullRequest.repository.name,
    pull_number: pullRequest.number,
  });

  return { pullRequest, files };
}

function buildReviewPrompt(
  pullRequest: { number: number; title: string },
  files: Array<{ filename: string; status: string; patch?: string }>
): ChatMessageInput[] {
  const diffText = files
    .map((f) => `--- ${f.filename} (${f.status}) ---\n${f.patch ?? "(no textual patch available, e.g. binary file)"}`)
    .join("\n\n");

  const system: ChatMessageInput = {
    role: "system",
    content: `You are a senior software engineer performing a code review on a GitHub pull request diff.

Respond with ONLY a single JSON object, no markdown code fences, no other text, matching exactly this shape:
{
  "summary": "one or two sentence overall summary of the PR",
  "findings": [
    { "filePath": "path/to/file", "lineNumber": 42, "severity": "info" | "warning" | "critical", "comment": "specific, actionable comment" }
  ]
}

"lineNumber" should be the line number in the file's new version where relevant, or null for a file-level/general finding. Only raise findings that are genuinely useful — bugs, correctness issues, missing error handling, security concerns, unclear naming, missing tests. Do not pad the list with trivial style nitpicks. If the diff looks fine, return an empty findings array rather than inventing issues.`,
  };

  const user: ChatMessageInput = {
    role: "user",
    content: `Review pull request #${pullRequest.number}: "${pullRequest.title}"\n\n${diffText}`,
  };

  return [system, user];
}

function parseReviewResponse(raw: string): ParsedReview {
  // Models sometimes wrap JSON in markdown fences despite instructions not to — strip defensively.
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.findings)) {
    throw new Error("LLM response did not match expected review shape");
  }

  return parsed as ParsedReview;
}

export async function runCodeReview(pullRequestId: string) {
  const codeReview = await prisma.codeReview.create({
    data: { pullRequestId, status: "pending" },
  });

  try {
    const { pullRequest, files } = await fetchPullRequestDiff(pullRequestId);
    const messages = buildReviewPrompt(pullRequest, files);
    const { provider, model, stream } = await streamChatCompletion(messages);

    let fullText = "";
    for await (const chunk of stream) {
      fullText += chunk;
    }

    const parsed = parseReviewResponse(fullText);

    return prisma.codeReview.update({
      where: { id: codeReview.id },
      data: {
        status: "completed",
        summary: parsed.summary,
        provider,
        model,
        completedAt: new Date(),
        findings: {
          create: parsed.findings.map((f) => ({
            filePath: f.filePath,
            lineNumber: f.lineNumber,
            severity: f.severity,
            comment: f.comment,
          })),
        },
      },
      include: { findings: true },
    });
  } catch (err) {
    return prisma.codeReview.update({
      where: { id: codeReview.id },
      data: {
        status: "failed",
        errorMessage: String(err instanceof Error ? err.message : err),
        completedAt: new Date(),
      },
    });
  }
}