import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "database/client";
import { redirect, notFound } from "next/navigation";
import { syncPullRequestsAndIssuesAction } from "@/lib/actions";
import {
  getOrCreateChatSession,
  getChatMessages,
} from "@/lib/chat-session";

import type { IndexStatus } from "@/lib/index-repository";

import SyncButton from "@/components/SyncButton";
import PullRequestCard from "@/components/PullRequestCard";
import ChatPanel from "@/components/ChatPanel";
import IndexRepositoryButton from "@/components/IndexRepositoryButton";
import StatChip from "@/components/StatChip";
import RepositoryHealth from "@/components/RepositoryHealth";
import DeveloperOnboarding from "@/components/DeveloperOnboarding";
import ArchitectureDiagramPanel from "@/components/ArchitectureDiagramPanel";
import RepoSearch from "@/components/RepoSearch";
import { IndexStatusProvider } from "@/lib/index-status-content";

type HealthStatus =
  | "NOT_COMPUTED"
  | "COMPUTING"
  | "COMPUTED"
  | "FAILED";

export default async function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const repository = await prisma.repository.findUnique({
    where: {
      id,
    },
    include: {
      pullRequests: {
        orderBy: {
          githubUpdatedAt: "desc",
        },
        include: {
          codeReviews: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              findings: true,
            },
          },
        },
      },

      issues: {
        orderBy: {
          githubUpdatedAt: "desc",
        },
      },

      healthScore: true,

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
    notFound();
  }

  const [chatSession, latestDiagram] = await Promise.all([
    getOrCreateChatSession(session.user.id, repository.id),

    prisma.architectureDiagram.findFirst({
      where: {
        repositoryId: repository.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const chatMessages = await getChatMessages(chatSession.id);

  const openPrCount = repository.pullRequests.filter(
    (pr) => pr.state === "open",
  ).length;

  const openIssueCount = repository.issues.filter(
    (issue) => issue.state === "open",
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <IndexStatusProvider
        initialStatus={repository.indexStatus as IndexStatus}
        initialLastIndexedAt={
          repository.lastIndexedAt?.toISOString() ?? null
        }
        initialCurrentIndexRunId={repository.activeIndexRunId}
      >
      {/* ─────────────────────────────────────────────
          Back navigation
      ───────────────────────────────────────────── */}
      <Link
        href="/repositories"
        className="mb-7 inline-flex items-center gap-1.5 font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim transition-colors hover:text-phosphor"
      >
        ← back to repositories
      </Link>

      {/* ─────────────────────────────────────────────
          Repository identity
      ───────────────────────────────────────────── */}
      <header className="border-b border-panel-border pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-3 font-mono-ui text-xs text-phosphor">
              $ cd ./{repository.fullName}
              <span
                className="cursor-blink ml-1 inline-block h-3.5 w-1.75 align-[-2px] bg-phosphor"
                aria-hidden="true"
              />
            </p>

            <h1 className="truncate font-display text-2xl font-bold uppercase leading-tight text-paper sm:text-3xl">
              {repository.fullName}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim">
              <span>
                {repository.isPrivate ? "PRIVATE" : "PUBLIC"}
              </span>

              <span className="text-panel-border">·</span>

              <span>
                DEFAULT BRANCH{" "}
                <span className="text-paper">
                  {repository.defaultBranch}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <form action={syncPullRequestsAndIssuesAction}>
              <input
                type="hidden"
                name="repositoryId"
                value={repository.id}
              />

              <SyncButton
                lastSyncedAt={
                  repository.lastSyncedAt?.toISOString() ?? null
                }
              />
            </form>

            <IndexRepositoryButton
              repositoryId={repository.id}
              initialError={repository.lastIndexError}
            />
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────
          Repository statistics
      ───────────────────────────────────────────── */}
      <section className="py-7">
        <div className="grid grid-cols-2 gap-px border border-panel-border bg-panel-border sm:grid-cols-4">
          <StatChip
            label="Pull requests"
            value={repository.pullRequests.length}
          />

          <StatChip
            label="Open PRs"
            value={openPrCount}
          />

          <StatChip
            label="Issues"
            value={repository.issues.length}
          />

          <StatChip
            label="Open issues"
            value={openIssueCount}
            accent="amber"
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          Repository intelligence
      ───────────────────────────────────────────── */}
      <div className="space-y-8">
        {/* Health */}
        <section>
          <SectionHeading label="Repository health" />

          <RepositoryHealth
            repositoryId={repository.id}
            initialStatus={
              repository.healthStatus as HealthStatus
            }
            initialComputedAt={
              repository.lastHealthComputedAt?.toISOString() ??
              null
            }
            initialError={repository.lastHealthError}
            initialScore={
              repository.healthScore
                ? {
                    overallScore:
                      repository.healthScore.overallScore,

                    securityScore:
                      repository.healthScore.securityScore,

                    vulnerabilityCriticalCount:
                      repository.healthScore
                        .vulnerabilityCriticalCount,

                    vulnerabilityHighCount:
                      repository.healthScore
                        .vulnerabilityHighCount,

                    vulnerabilityModerateCount:
                      repository.healthScore
                        .vulnerabilityModerateCount,

                    vulnerabilityLowCount:
                      repository.healthScore
                        .vulnerabilityLowCount,

                    complexityScore:
                      repository.healthScore.complexityScore,

                    avgCyclomaticComplexity:
                      repository.healthScore
                        .avgCyclomaticComplexity,

                    highComplexityFileCount:
                      repository.healthScore
                        .highComplexityFileCount,

                    documentationScore:
                      repository.healthScore.documentationScore,

                    documentedExportRatio:
                      repository.healthScore
                        .documentedExportRatio,

                    hasReadme:
                      repository.healthScore.hasReadme,

                    activityScore:
                      repository.healthScore.activityScore,

                    commitsLast90Days:
                      repository.healthScore
                        .commitsLast90Days,

                    prMergeRate:
                      repository.healthScore.prMergeRate,

                    computedAt:
                      repository.healthScore.computedAt.toISOString(),
                  }
                : null
            }
          />
        </section>

        {/* Onboarding */}
        <section>
          <SectionHeading label="Developer onboarding" />

          <DeveloperOnboarding
            repositoryId={repository.id}
            initialGuide={repository.onboardingGuide}
          />
        </section>

        {/* Architecture */}
        <section>
          <SectionHeading label="System architecture" />

          <ArchitectureDiagramPanel
            repositoryId={repository.id}
            initialDiagram={
              latestDiagram
                ? {
                    id: latestDiagram.id,
                    status:
                      latestDiagram.status as
                        | "pending"
                        | "completed"
                        | "failed",
                    summary: latestDiagram.summary,
                    mermaidCode:
                      latestDiagram.mermaidCode,
                    sourceIndexRunId:
                      latestDiagram.sourceIndexRunId,
                    errorMessage:
                      latestDiagram.errorMessage,
                  }
                : null
            }
          />
        </section>

        {/* Code search */}
        <section>
          <SectionHeading label="Code search" />

          <RepoSearch
            repositoryId={repository.id}
          />
        </section>
      </div>

      {/* ─────────────────────────────────────────────
          Repository activity
      ───────────────────────────────────────────── */}
      <section className="mt-12 border-t border-panel-border pt-8">
        <SectionHeading label="Repository activity" />

        <div className="space-y-8">
          {/* Pull Requests */}
          <div>
            <SubsectionHeading
              label={`Pull requests (${repository.pullRequests.length})`}
            />

            {repository.pullRequests.length === 0 ? (
              <EmptyRow text="No pull requests synced yet." />
            ) : (
              <div className="space-y-3">
                {repository.pullRequests.map((pr) => (
                  <PullRequestCard
                    key={pr.id}
                    pullRequest={pr}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          <div>
            <SubsectionHeading
              label={`Issues (${repository.issues.length})`}
            />

            {repository.issues.length === 0 ? (
              <EmptyRow text="No issues synced yet." />
            ) : (
              <div className="divide-y divide-panel-border rounded-md border border-panel-border bg-panel">
                {repository.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div>
                        <span className="font-mono-ui text-xs text-phosphor">
                          #{issue.number}
                        </span>{" "}
                        <span className="text-sm text-paper">
                          {issue.title}
                        </span>
                      </div>

                      <p className="mt-0.5 font-mono-ui text-[10px] text-paper-dim">
                        {issue.authorLogin}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 font-mono-ui text-[10px] uppercase tracking-wide ${
                        issue.state === "open"
                          ? "text-phosphor"
                          : "text-paper-dim"
                      }`}
                    >
                      {issue.state}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          AI Copilot
      ───────────────────────────────────────────── */}
      <section className="mt-12 border-t border-panel-border pt-8">
        <div className="mb-4 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-mono-ui text-sm font-semibold uppercase tracking-[0.08em] text-paper">
              AI Copilot
            </h2>

            <span className="border border-panel-border px-1.5 py-0.5 font-mono-ui text-[9px] uppercase tracking-wider text-paper-dim">
              ASSISTANT
            </span>
          </div>

          <p className="max-w-xl text-xs leading-relaxed text-paper-dim">
            Ask questions and get help understanding this
            repository.
          </p>
        </div>

        <ChatPanel
          repositoryId={repository.id}
          initialMessages={chatMessages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            provider: message.provider,
            model: message.model,
          }))}
        />
      </section>
      </IndexStatusProvider>
    </main>
  );
}

function SectionHeading({
  label,
}: {
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-paper-dim">
        {label}
      </h2>

      <div className="h-px flex-1 bg-panel-border" />
    </div>
  );
}

function SubsectionHeading({
  label,
}: {
  label: string;
}) {
  return (
    <h3 className="mb-3 font-mono-ui text-[10px] uppercase tracking-widest text-paper-dim">
      {label}
    </h3>
  );
}

function EmptyRow({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-md border border-panel-border bg-panel px-4 py-6 text-center font-mono-ui text-xs text-paper-dim">
      {text}
    </div>
  );
}