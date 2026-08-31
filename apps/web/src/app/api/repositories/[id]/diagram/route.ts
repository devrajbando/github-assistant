import { prisma } from "database/client";
import { auth } from "@/auth";
import { generateArchitectureDiagram } from "@/lib/generate-architecture-diagram";

async function checkOwnership(repositoryId: string, userId: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { userId: true },
  });
  return repository?.userId === userId;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  if (!(await checkOwnership(repositoryId, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const diagram = await generateArchitectureDiagram(repositoryId);
    if (diagram.status === "failed") {
      return Response.json({ error: diagram.errorMessage ?? "Diagram generation failed" }, { status: 500 });
    }
    return Response.json({ diagram });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Not indexed yet is an expected state, not a server error.
    const status = message.includes("has not been indexed") ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  if (!(await checkOwnership(repositoryId, session.user.id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const diagram = await prisma.architectureDiagram.findFirst({
    where: { repositoryId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ diagram });
}