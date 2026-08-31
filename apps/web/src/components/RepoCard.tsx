import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";

type RepoCardProps = {
  repo: {
    id: string;
    name: string;
    fullName: string;
    owner: string;
    isPrivate: boolean;
    defaultBranch: string;
    updatedAt: Date;
    _count: { pullRequests: number; issues: number };
  };
};

export default function RepoCard({ repo }: RepoCardProps) {
  return (
    <Link
      href={`/repositories/${repo.id}`}
      className="group flex flex-col rounded-md border border-panel-border bg-panel transition-colors hover:border-phosphor-dim hover:shadow-[0_0_26px_rgba(61,255,143,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              repo.isPrivate
                ? "bg-amber shadow-[0_0_8px_var(--color-amber)]"
                : "pulse-dot bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]"
            }`}
            aria-hidden="true"
          />
          <span className="truncate">{repo.owner}</span>
        </span>
        <span className="shrink-0">{repo.isPrivate ? "PRIVATE" : "PUBLIC"}</span>
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <h3 className="mb-1 truncate font-display text-[15px] uppercase tracking-wide text-paper group-hover:text-phosphor">
          {repo.name}
        </h3>
        <p className="mb-6 truncate font-mono-ui text-xs text-paper-dim">
          {repo.fullName}
        </p>

        <div className="mt-auto flex items-center gap-4 font-mono-ui text-xs text-paper-dim">
          <span className="flex items-center gap-1.5" title="Default branch">
            <BranchIcon />
            {repo.defaultBranch}
          </span>
          <span className="flex items-center gap-1.5" title="Open pull requests">
            <PrIcon />
            {repo._count.pullRequests}
          </span>
          <span className="flex items-center gap-1.5" title="Open issues">
            <IssueIcon />
            {repo._count.issues}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-panel-border px-4 py-2.5 font-mono-ui text-[10.5px] text-paper-dim">
        <span>SYNCED {formatRelativeTime(repo.updatedAt).toUpperCase()}</span>
        <span className="text-phosphor-dim group-hover:text-phosphor">OPEN →</span>
      </div>
    </Link>
  );
}

function BranchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 stroke-current"
      aria-hidden="true"
    >
      <circle cx="4" cy="3" r="1.4" />
      <circle cx="4" cy="13" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <path d="M4 4.4v7M4 8c0-2 2-3 4-3h2.6" />
    </svg>
  );
}

function PrIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 stroke-current"
      aria-hidden="true"
    >
      <circle cx="4" cy="3" r="1.4" />
      <circle cx="4" cy="13" r="1.4" />
      <circle cx="12" cy="9.5" r="1.4" />
      <path d="M4 4.4v6M4 6c0 2.4 2.6 3.3 5.2 3.6M12 8.1V3" />
    </svg>
  );
}

function IssueIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 stroke-current"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" />
      <line x1="8" y1="5.3" x2="8" y2="8.6" />
      <circle cx="8" cy="10.9" r="0.6" className="fill-current" stroke="none" />
    </svg>
  );
}