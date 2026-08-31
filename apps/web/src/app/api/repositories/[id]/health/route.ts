// apps/web/src/app/api/repositories/[id]/health/route.ts
import { prisma } from "database/client";
import { auth } from "@/auth";
import { startRepoHealthComputation } from "@/lib/compute-repo-health";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repositoryId } = await params;
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: {
      userId: true,
      healthStatus: true,
      lastHealthComputedAt: true,
      lastHealthError: true,
      healthScore: true,
    },
  });

  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    status: repository.healthStatus,
    lastHealthComputedAt: repository.lastHealthComputedAt,
    lastHealthError: repository.lastHealthError,
    score: repository.healthScore,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: repositoryId } = await params;
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await startRepoHealthComputation(repositoryId);
    return Response.json({ status: "started" }, { status: 202 });
  } catch (err) {
    return Response.json(
      { status: "failed", error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}