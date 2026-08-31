import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "database/client";
import { redirect } from "next/navigation";
import { syncRepositoriesAction } from "@/lib/actions";
import SyncButton from "@/components/SyncButton";
import RepoCard from "@/components/RepoCard";
import StatChip from "@/components/StatChip";
import RepoFilterBar, { type IndexFilter, type SortOption, type VisibilityFilter } from "@/components/RepoFilterBar";

const SORT_OPTIONS: SortOption[] = ["updated", "name", "open_prs", "open_issues"];
const VISIBILITY_OPTIONS: VisibilityFilter[] = ["all", "public", "private"];
const INDEX_OPTIONS: IndexFilter[] = ["all", "indexed", "not_indexed"];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pickOption<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

async function syncRepositoriesFormAction() {
  "use server";
  await syncRepositoriesAction();
}

export default async function RepositoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const rawParams = await searchParams;
  const query = (firstValue(rawParams.q) ?? "").trim();
  const sort = pickOption(firstValue(rawParams.sort), SORT_OPTIONS, "updated");
  const visibility = pickOption(firstValue(rawParams.visibility), VISIBILITY_OPTIONS, "all");
  const indexed = pickOption(firstValue(rawParams.indexed), INDEX_OPTIONS, "all");

  const where = {
    userId: session.user.id,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { fullName: { contains: query, mode: "insensitive" as const } },
            { owner: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(visibility === "private" ? { isPrivate: true } : {}),
    ...(visibility === "public" ? { isPrivate: false } : {}),
    ...(indexed === "indexed" ? { indexStatus: "INDEXED" } : {}),
    ...(indexed === "not_indexed" ? { indexStatus: { not: "INDEXED" } } : {}),
  };

  const [repositories, totalReposUnfiltered] = await Promise.all([
    prisma.repository.findMany({
      where,
      orderBy: sort === "name" ? { name: "asc" } : { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            pullRequests: { where: { state: "open" } },
            issues: { where: { state: "open" } },
          },
        },
      },
    }),
    prisma.repository.count({ where: { userId: session.user.id } }),
  ]);

  // "Most open PRs/issues" sorts on a *filtered* relation count, which
  // Prisma's orderBy can't express at the DB level (it only supports
  // ordering by a relation's total count, not a filtered one) — so this
  // sorts the already-fetched page in memory instead of hitting the DB.
  if (sort === "open_prs") {
    repositories.sort((a, b) => b._count.pullRequests - a._count.pullRequests);
  } else if (sort === "open_issues") {
    repositories.sort((a, b) => b._count.issues - a._count.issues);
  }

  const totalRepos = repositories.length;
  const privateCount = repositories.filter((r) => r.isPrivate).length;
  const openPrCount = repositories.reduce((sum, r) => sum + r._count.pullRequests, 0);
  const openIssueCount = repositories.reduce((sum, r) => sum + r._count.issues, 0);

  const hasActiveFilters = Boolean(query) || sort !== "updated" || visibility !== "all" || indexed !== "all";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-12 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 font-mono-ui text-xs text-paper-dim transition-colors hover:text-phosphor"
      >
        ← back to home
      </Link>

      <div className="mb-10 flex flex-col gap-6 border-b border-panel-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 font-mono-ui text-sm text-phosphor">
            $ ./repositories.sh --sync
            <span
              className="cursor-blink ml-1 inline-block h-3.5 w-1.75 align-[-2px] bg-phosphor"
              aria-hidden="true"
            />
          </p>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">
            Repository index
          </h1>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-paper-dim">
            {totalReposUnfiltered > 0
              ? hasActiveFilters
                ? `${totalRepos} of ${totalReposUnfiltered} repositor${totalReposUnfiltered === 1 ? "y" : "ies"} shown.`
                : `${totalReposUnfiltered} repositor${totalReposUnfiltered === 1 ? "y" : "ies"} synced from your GitHub account.`
              : "No repositories synced yet. Run a sync to pull them in from GitHub."}
          </p>
        </div>

        <form action={syncRepositoriesFormAction}>
          <SyncButton />
        </form>
      </div>

      {totalReposUnfiltered > 0 && (
        <>
          <Suspense fallback={null}>
            <RepoFilterBar query={query} sort={sort} visibility={visibility} indexed={indexed} />
          </Suspense>

          <div className="mb-10 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatChip label="Repositories" value={totalRepos} />
            <StatChip label="Private" value={privateCount} accent="amber" />
            <StatChip label="Open PRs" value={openPrCount} />
            <StatChip label="Open issues" value={openIssueCount} />
          </div>
        </>
      )}

      {totalReposUnfiltered === 0 ? (
        <EmptyState />
      ) : totalRepos > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      ) : (
        <NoMatchesState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-md border border-panel-border bg-panel px-6 py-16 text-center">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-5 h-9 w-9 stroke-paper-dim"
        aria-hidden="true"
      >
        <ellipse cx="16" cy="16" rx="12" ry="6" transform="rotate(-20 16 16)" />
        <ellipse cx="16" cy="16" rx="12" ry="6" transform="rotate(20 16 16)" />
        <circle cx="16" cy="16" r="2" className="fill-paper-dim" stroke="none" />
      </svg>
      <h2 className="mb-2 font-display text-lg uppercase tracking-wide">No signal</h2>
      <p className="max-w-[40ch] text-sm leading-relaxed text-paper-dim">
        Nothing synced yet. Run a sync above to pull your repositories, pull
        requests, and issues in from GitHub.
      </p>
    </div>
  );
}

function NoMatchesState() {
  return (
    <div className="flex flex-col items-center rounded-md border border-panel-border bg-panel px-6 py-16 text-center">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-5 h-9 w-9 stroke-paper-dim"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="8" />
        <path d="M20 20l7 7" strokeLinecap="round" />
      </svg>
      <h2 className="mb-2 font-display text-lg uppercase tracking-wide">No matches</h2>
      <p className="max-w-[40ch] text-sm leading-relaxed text-paper-dim">
        No repositories match the current search and filters.
      </p>
      <Link
        href="/repositories"
        className="mt-4 font-mono-ui text-xs text-phosphor underline decoration-phosphor-dim underline-offset-2 hover:text-phosphor"
      >
        Clear filters
      </Link>
    </div>
  );
}