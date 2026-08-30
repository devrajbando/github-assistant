import { prisma } from "database/client";
import { createGitHubClient } from "./github";

async function main() {
  const account = await prisma.account.findFirst({
    where: { provider: "github" },
  });

  if (!account?.access_token) {
    throw new Error("No GitHub account/token found — sign in first.");
  }

  const octokit = createGitHubClient(account.access_token);

  const { data: user } = await octokit.rest.users.getAuthenticated();
  console.log("Authenticated as:", user.login);

  const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
    per_page: 5,
  });
  console.log(
    "First few repos:",
    repos.map((r) => r.full_name)
  );
}

main().catch(console.error);