import { prisma } from "database/client";

import { auth } from "@/auth";
import { startOnboardingGeneration } from "@/lib/generate-onboarding";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: {
      userId: true,
      onboardingGuide: {
        include: {
          checklistItems: {
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  });

  if (!repository || repository.userId !== session.user.id) {
    return Response.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  return Response.json({
    guide: repository.onboardingGuide,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id: repositoryId } = await params;

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!repository || repository.userId !== session.user.id) {
    return Response.json(
      { error: "Not found" },
      { status: 404 },
    );
  }

  try {
    await startOnboardingGeneration(repositoryId);

    return Response.json(
      { status: "started" },
      { status: 202 },
    );
  } catch (error) {
    return Response.json(
      {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id: repositoryId } = await params;

  try {
    const body = await request.json();

    const { itemId, isCompleted } = body;

    if (
      typeof itemId !== "string" ||
      typeof isCompleted !== "boolean"
    ) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!repository || repository.userId !== session.user.id) {
      return Response.json(
        { error: "Not found" },
        { status: 404 },
      );
    }

    const item = await prisma.onboardingChecklistItem.findFirst({
      where: {
        id: itemId,
        onboardingGuide: {
          repositoryId,
        },
      },
    });

    if (!item) {
      return Response.json(
        { error: "Checklist item not found" },
        { status: 404 },
      );
    }

    const updatedItem =
      await prisma.onboardingChecklistItem.update({
        where: {
          id: itemId,
        },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      });

    return Response.json({
      item: updatedItem,
    });
  } catch (error) {
    console.error("Failed to update checklist item:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}