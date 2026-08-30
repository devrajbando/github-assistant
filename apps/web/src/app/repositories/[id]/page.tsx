
import { auth } from "@/auth";
import { prisma } from "database/client";
import { syncPullRequestsAndIssuesAction } from "@/lib/actions";
import { redirect, notFound } from "next/navigation";
import { SyncButton } from "@/components/SyncButton";
import Link from "next/link";
import { ChatPanel } from "@/components/ChatPanel";
import { getOrCreateChatSession, getChatMessages } from "@/lib/chat-session";
import { PullRequestCard } from "@/components/PullRequestCard";
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
    issues: {
      orderBy: { githubUpdatedAt: "desc" },
    },
  },
});

  if (!repository) {
    notFound();
  }
  const chatSession = await getOrCreateChatSession(session.user.id, repository.id);
const chatMessages = await getChatMessages(chatSession.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/repositories" className="text-sm text-gray-500 hover:underline">
        ← Back to repositories
      </Link>

      <div className="mt-4 mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {repository.fullName}
        </h1>
        <form action={syncPullRequestsAndIssuesAction}>
        <input type="hidden" name="repositoryId" value={repository.id} />
        <SyncButton />
        </form>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pull Requests ({repository.pullRequests.length})
        </h2>
        {repository.pullRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No pull requests synced yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
                        {repository.pullRequests.map((pr) => (
              <PullRequestCard
                key={pr.id}
                pullRequestId={pr.id}
                number={pr.number}
                title={pr.title}
                state={pr.state}
                isMerged={pr.isMerged}
                initialReview={pr.codeReviews[0] ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Issues ({repository.issues.length})
        </h2>
        {repository.issues.length === 0 ? (
          <p className="text-sm text-gray-500">No issues synced yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {repository.issues.map((issue) => (
              <li key={issue.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-900">
                  #{issue.number} {issue.title}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {issue.state}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
          <ChatPanel
        repositoryId={repository.id}
        initialMessages={chatMessages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      />
    </div>
  );
}