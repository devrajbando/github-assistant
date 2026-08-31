import { prisma } from "database/client";
import { auth } from "@/auth";
import { searchRepository } from "@/lib/search-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { userId: true },
  });

  if (!repository || repository.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return Response.json({ error: "Query is required" }, { status: 400 });
  }

  try {
    const results = await searchRepository(repositoryId, query);
    return Response.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Not indexed yet is an expected state, not a server error.
    const status = message.includes("has not been indexed") ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}