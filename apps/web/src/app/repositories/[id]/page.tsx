import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "database/client";
import { redirect, notFound } from "next/navigation";
import { syncPullRequestsAndIssuesAction } from "@/lib/actions";
import { getOrCreateChatSession, getChatMessages } from "@/lib/chat-session";
import type { IndexStatus } from "@/lib/index-repository";
import SyncButton from "@/components/SyncButton";
import PullRequestCard from "@/components/PullRequestCard";
import ChatPanel from "@/components/ChatPanel";
import IndexRepositoryButton from "@/components/IndexRepositoryButton";
import StatChip from "@/components/StatChip";

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

  const repository = await prisma.repository.findFirst({
    where: { id, userId: session.user.id },
    include: {
      pullRequests: {
        orderBy: { githubUpdatedAt: "desc" },
        include: {
          codeReviews: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { findings: true },
          },
        },
      },
      issues: { orderBy: { githubUpdatedAt: "desc" } },
    },
  });

  if (!repository) {
    notFound();
  }

  const chatSession = await getOrCreateChatSession(session.user.id, repository.id);
  const chatMessages = await getChatMessages(chatSession.id);

  const openPrCount = repository.pullRequests.filter((pr) => pr.state === "open").length;
  const openIssueCount = repository.issues.filter((i) => i.state === "open").length;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-12 sm:py-16">
      <Link
        href="/repositories"
        className="mb-6 inline-flex items-center gap-1.5 font-mono-ui text-xs text-paper-dim transition-colors hover:text-phosphor"
      >
        ← back to index
      </Link>

      <div className="mb-8 flex flex-col gap-6 border-b border-panel-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-3 font-mono-ui text-sm text-phosphor">
            $ cd ./{repository.fullName}
            <span
              className="cursor-blink ml-1 inline-block h-3.5 w-1.75 align-[-2px] bg-phosphor"
              aria-hidden="true"
            />
          </p>
          <h1 className="truncate font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">
            {repository.fullName}
          </h1>
          <p className="mt-2 font-mono-ui text-xs text-paper-dim">
            {repository.isPrivate ? "PRIVATE" : "PUBLIC"} · DEFAULT BRANCH{" "}
            {repository.defaultBranch}
          </p>
        </div>

        <form action={syncPullRequestsAndIssuesAction}>
          <input type="hidden" name="repositoryId" value={repository.id} />
          <SyncButton/>
        </form>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatChip label="Pull requests" value={repository.pullRequests.length} />
        <StatChip label="Open PRs" value={openPrCount} />
        <StatChip label="Issues" value={repository.issues.length} />
        <StatChip label="Open issues" value={openIssueCount} accent="amber" />
      </div>

      <section className="mb-10">
        <SectionHeading label={`Pull requests (${repository.pullRequests.length})`} />
        {repository.pullRequests.length === 0 ? (
          <EmptyRow text="No pull requests synced yet." />
        ) : (
          <div className="space-y-3">
            {repository.pullRequests.map((pr) => (
              <PullRequestCard key={pr.id} pullRequest={pr} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionHeading label={`Issues (${repository.issues.length})`} />
        {repository.issues.length === 0 ? (
          <EmptyRow text="No issues synced yet." />
        ) : (
          <div className="divide-y divide-panel-border rounded-md border border-panel-border bg-panel">
            {repository.issues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <span className="font-mono-ui text-xs text-phosphor">#{issue.number}</span>{" "}
                  <span className="text-sm text-paper">{issue.title}</span>
                  <p className="mt-0.5 font-mono-ui text-[11px] text-paper-dim">
                    {issue.authorLogin}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono-ui text-[10.5px] uppercase tracking-wide ${
                    issue.state === "open" ? "text-phosphor" : "text-paper-dim"
                  }`}
                >
                  {issue.state}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono-ui text-[11px] uppercase tracking-widest text-paper-dim">
            AI copilot
          </h2>
          <IndexRepositoryButton
            repositoryId={repository.id}
            initialStatus={repository.indexStatus as IndexStatus}
            initialLastIndexedAt={repository.lastIndexedAt?.toISOString() ?? null}
            initialError={repository.lastIndexError}
          />
        </div>
        <ChatPanel
          repositoryId={repository.id}
          initialMessages={chatMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            provider: m.provider,
            model: m.model,
          }))}
        />
      </section>
    </div>
  );
}

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 className="mb-3 font-mono-ui text-[11px] uppercase tracking-widest text-paper-dim">
      {label}
    </h2>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-panel-border bg-panel px-4 py-6 text-center font-mono-ui text-xs text-paper-dim">
      {text}
    </div>
  );
}