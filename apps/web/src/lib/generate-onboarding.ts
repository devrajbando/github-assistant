import { prisma } from "database/client";

import { streamChatCompletion } from "./llm";
import { buildRepoContextMessage } from "./llm/context";
import { parseJsonLlmResponse } from "@/lib/llm/parse-json-response";

async function consumeStream(stream: AsyncIterable<string>): Promise<string> {
  let content = "";

  for await (const chunk of stream) {
    content += chunk;
  }

  return content.trim();
}

export async function startOnboardingGeneration(
  repositoryId: string,
): Promise<void> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      onboardingGuide: true,
    },
  });

  if (!repository) {
    throw new Error(`Repository ${repositoryId} not found`);
  }

  if (repository.onboardingGuide?.status === "GENERATING") {
    throw new Error(
      "Onboarding guide generation already in progress for this repository",
    );
  }

  const guide = await prisma.onboardingGuide.upsert({
    where: { repositoryId },
    create: {
      repositoryId,
      status: "GENERATING",
      content: null,
      lastError: null,
    },
    update: {
      status: "GENERATING",
      lastError: null,
    },
  });

  // Start the actual AI work in the background.
  runOnboardingGeneration(repositoryId, guide.id).catch((error) => {
    console.error(
      `Onboarding generation failed for repository ${repositoryId}:`,
      error,
    );
  });
}

async function runOnboardingGeneration(
  repositoryId: string,
  guideId: string,
): Promise<void> {
  try {
    const repository = await prisma.repository.findUniqueOrThrow({
      where: { id: repositoryId },
      include: {
        healthScore: true,
      },
    });

    const contextMessage = await buildRepoContextMessage(repositoryId);

    const health = repository.healthScore;

    const healthContext = health
      ? `
Repository health:
- Overall score: ${health.overallScore}/100
- Security score: ${health.securityScore}/100
- Complexity score: ${health.complexityScore}/100
- Documentation score: ${health.documentationScore}/100
- Activity score: ${health.activityScore}/100
- Average cyclomatic complexity: ${health.avgCyclomaticComplexity.toFixed(1)}
- High-complexity files: ${health.highComplexityFileCount}
- README: ${health.hasReadme ? "present" : "missing"}
- Commits in last 90 days: ${health.commitsLast90Days}
- PR merge rate: ${
          health.prMergeRate === null
            ? "not available"
            : `${Math.round(health.prMergeRate * 100)}%`
        }
`
      : `
Repository health has not been computed yet.
Do not invent health information.
`;

    const prompt = `
Generate a developer onboarding package for this GitHub repository.

Repository:
- Name: ${repository.name}
- Full name: ${repository.fullName}
- Owner: ${repository.owner}
- Default branch: ${repository.defaultBranch}
- Visibility: ${repository.isPrivate ? "private" : "public"}

${healthContext}

Repository context:
${contextMessage.content}

The package is intended for a developer who has never worked on this repository before.

Return ONLY valid JSON.

The JSON must have exactly this structure:

{
  "guide": "Markdown string",
  "checklist": [
    {
      "key": "stable-kebab-case-key",
      "category": "ORIENTATION | SETUP | ARCHITECTURE | DEVELOPMENT | CONTRIBUTION",
      "title": "Short checklist title",
      "description": "Practical explanation"
    }
  ]
}

The guide must be Markdown and contain exactly these sections:

# Project Overview

# Technology Stack

# Architecture

# Project Structure

# Development Setup

# Important Areas

# Contribution Guide

Rules:
- Do not fabricate files, technologies, commands, architecture, or workflows.
- If information is unavailable, explicitly say:
  "Not established from the available repository data."
- Clearly distinguish known facts from reasonable inferences.
- Prefer concrete repository information over generic software-development advice.
- Create 5-10 useful checklist items.
- Checklist items must be practical actions for a new developer.
- Use stable kebab-case keys.
- Return no Markdown code fence around the JSON.
`;

    const result = await streamChatCompletion([
      {
        role: "system",
        content:
          "You are a senior software engineer creating repository onboarding documentation. Ground every statement in the supplied repository data.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]);

    const rawContent = await consumeStream(result.stream);

if (!rawContent) {
  throw new Error("LLM returned an empty onboarding guide");
}


const parsed = parseJsonLlmResponse<{
  guide: string;
  checklist: Array<{
    key: string;
    category: string;
    title: string;
    description: string;
  }>;
}>(rawContent);

// try {
//   parsed = JSON.parse(rawContent);
// } catch {
//   throw new Error("LLM returned invalid onboarding JSON");
// }

// if (
//   typeof parsed.guide !== "string" ||
//   !Array.isArray(parsed.checklist)
// ) {
//   throw new Error("LLM returned an invalid onboarding structure");
// }

   await prisma.$transaction(async (tx) => {
  await tx.onboardingChecklistItem.deleteMany({
    where: {
      onboardingGuideId: guideId,
    },
  });

  await tx.onboardingGuide.update({
    where: {
      id: guideId,
    },
    data: {
      status: "GENERATED",
      content: parsed.guide,
      provider: result.provider,
      model: result.model,
      generatedAt: new Date(),
      lastError: null,

      checklistItems: {
        create: parsed.checklist.map((item, index) => ({
          order: index,
          key: item.key,
          category: item.category,
          title: item.title,
          description: item.description,
        })),
      },
    },
  });
});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    await prisma.onboardingGuide.update({
      where: { id: guideId },
      data: {
        status: "FAILED",
        lastError: message,
      },
    });

    throw error;
  }
}