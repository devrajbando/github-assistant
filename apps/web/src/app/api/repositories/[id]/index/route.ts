import { prisma } from "database/client";
import { auth } from "@/auth";
import { startRepositoryIndexing } from "@/lib/index-repository";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: {
      userId: true,
      indexStatus: true,
      lastIndexedAt: true,
      lastIndexError: true,
    },
  });

  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    status: repository.indexStatus,
    lastIndexedAt: repository.lastIndexedAt,
    lastIndexError: repository.lastIndexError,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await startRepositoryIndexing(repositoryId);
    return Response.json({ status: "started" }, { status: 202 });
  } catch (err) {
    return Response.json(
      { status: "failed", error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}