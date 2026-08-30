import { prisma } from "database/client";
import { auth } from "@/auth";
import { runCodeReview } from "@/lib/code-review";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: pullRequestId } = await params;

  const pullRequest = await prisma.pullRequest.findUnique({
    where: { id: pullRequestId },
    include: { repository: true },
  });

  if (!pullRequest || pullRequest.repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const codeReview = await runCodeReview(pullRequestId);

  return Response.json(codeReview);
}