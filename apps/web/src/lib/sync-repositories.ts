import { prisma } from "database/client";
import { createGitHubClient } from "./github";

export async function syncRepositoriesForUser(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
  });

  if (!account?.access_token) {
    throw new Error(`No GitHub account/token found for user ${userId}`);
  }
  const octokit = createGitHubClient(account.access_token);

  // .paginate automatically follows GitHub's pagination until exhausted
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100 }
  );

  let syncedCount = 0;

  for (const repo of repos) {
    await prisma.repository.upsert({
      where: { githubRepoId: BigInt(repo.id) },
      create: {
        userId,
        githubRepoId: BigInt(repo.id),
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
      },
      update: {
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch,
      },
    });
    syncedCount++;
  }

  return { syncedCount };
}