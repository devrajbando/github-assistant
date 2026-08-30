import { prisma } from "database/client";
import { ChatMessageInput } from "./types";

const MAX_ITEMS = 10;

/**
 * Builds a system-role message summarizing a repo's metadata and
 * its most recently active PRs/issues, so chat answers are grounded
 * in real synced data rather than the model guessing.
 *
 * Reads only from Postgres (already-synced data) — makes no GitHub
 * API calls itself. Caller is responsible for verifying the
 * requesting user owns `repositoryId` before calling this.
 */
export async function buildRepoContextMessage(
  repositoryId: string
): Promise<ChatMessageInput> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }

  const [pullRequests, issues] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId },
      orderBy: { githubUpdatedAt: "desc" },
      take: MAX_ITEMS,
    }),
    prisma.issue.findMany({
      where: { repositoryId },
      orderBy: { githubUpdatedAt: "desc" },
      take: MAX_ITEMS,
    }),
  ]);

  const prLines = pullRequests.length
    ? pullRequests
        .map(
          (pr) =>
            `- #${pr.number} "${pr.title}" (${pr.state}${pr.isMerged ? ", merged" : ""}) by ${pr.authorLogin}, ${pr.headBranch} -> ${pr.baseBranch}`
        )
        .join("\n")
    : "(none synced)";

  const issueLines = issues.length
    ? issues
        .map((issue) => `- #${issue.number} "${issue.title}" (${issue.state}) by ${issue.authorLogin}`)
        .join("\n")
    : "(none synced)";

  const content = `You are an assistant answering questions about the GitHub repository "${repository.fullName}".

Repository info:
- Owner: ${repository.owner}
- Default branch: ${repository.defaultBranch}
- Visibility: ${repository.isPrivate ? "private" : "public"}

Most recently active pull requests (up to ${MAX_ITEMS}):
${prLines}

Most recently active issues (up to ${MAX_ITEMS}):
${issueLines}

Answer the user's questions using this context. If something isn't covered by the data above, say so rather than guessing — this data may not be fully up to date with GitHub.`;

  return { role: "system", content };
}