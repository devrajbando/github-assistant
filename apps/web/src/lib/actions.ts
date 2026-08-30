"use server";

import { auth } from "@/auth";
import { syncRepositoriesForUser } from "./sync-repositories";
import { revalidatePath } from "next/cache";
import { syncPullRequestsAndIssuesForRepo } from "./sync-pull-requests-and-issues";
import { prisma } from "database/client";
export async function syncRepositoriesAction() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const result = await syncRepositoriesForUser(session.user.id);

  // Tell Next.js the /repositories page's cached data is stale
  revalidatePath("/repositories");

  return result;
}
export async function syncPullRequestsAndIssuesAction(formData: FormData) {
  const repositoryId = formData.get("repositoryId") as string;

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const repository = await prisma.repository.findFirst({
    where: { id: repositoryId, userId: session.user.id },
  });

  if (!repository) {
    throw new Error("Repository not found or not owned by current user");
  }

  await syncPullRequestsAndIssuesForRepo(repositoryId);

  revalidatePath(`/repositories/${repositoryId}`);
}