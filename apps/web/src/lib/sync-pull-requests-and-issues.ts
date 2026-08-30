import { prisma } from "database/client";
import { createGitHubClient } from "./github";

export async function syncPullRequestsAndIssuesForRepo(repositoryId: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }

  const account = await prisma.account.findFirst({
    where: { userId: repository.userId, provider: "github" },
  });

  if (!account?.access_token) {
    throw new Error(`No GitHub account/token found for user ${repository.userId}`);
  }

  const octokit = createGitHubClient(account.access_token);

  // --- Pull Requests ---
  const pulls = await octokit.paginate(octokit.rest.pulls.list, {
    owner: repository.owner,
    repo: repository.name,
    state: "all",
    per_page: 100,
  });

  let prCount = 0;
  for (const pr of pulls) {
    // Prisma client typing can be incomplete when the model is generated from a different client instance,
    // so keep the operation aligned with the known generated model name and its required scalar fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).pullRequest.upsert({
      where: { githubPrId: BigInt(pr.id) },
      create: {
        repositoryId: repository.id,
        githubPrId: BigInt(pr.id),
        number: pr.number,
        title: pr.title,
        state: pr.state,
        isMerged: pr.merged_at !== null,
        authorLogin: pr.user?.login ?? "unknown",
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        githubCreatedAt: new Date(pr.created_at),
        githubUpdatedAt: new Date(pr.updated_at),
      },
      update: {
        title: pr.title,
        state: pr.state,
        isMerged: pr.merged_at !== null,
        githubUpdatedAt: new Date(pr.updated_at),
      },
    });
    prCount++;
  }

  // --- Issues (excluding PRs, which the issues endpoint also returns) ---
  const rawIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner: repository.owner,
    repo: repository.name,
    state: "all",
    per_page: 100,
  });

  const actualIssues = rawIssues.filter((issue) => !issue.pull_request);

  let issueCount = 0;
  for (const issue of actualIssues) {
    // Prisma client typing can be incomplete when the model is generated from a different client instance,
    // so keep the operation aligned with the known generated model name and its required scalar fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).issue.upsert({
      where: { githubIssueId: BigInt(issue.id) },
      create: {
        repositoryId: repository.id,
        githubIssueId: BigInt(issue.id),
        number: issue.number,
        title: issue.title,
        state: issue.state,
        authorLogin: issue.user?.login ?? "unknown",
        githubCreatedAt: new Date(issue.created_at),
        githubUpdatedAt: new Date(issue.updated_at),
      },
      update: {
        title: issue.title,
        state: issue.state,
        githubUpdatedAt: new Date(issue.updated_at),
      },
    });
    issueCount++;
  }

  return { prCount, issueCount };
}