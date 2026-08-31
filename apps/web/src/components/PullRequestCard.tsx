"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Finding = {
  id: string;
  filePath: string;
  lineNumber: number | null;
  severity: string;
  comment: string;
};

type CodeReview = {
  id: string;
  status: string;
  summary: string | null;
  provider: string | null;
  model: string | null;
  errorMessage: string | null;
  findings: Finding[];
};

type PullRequestCardProps = {
  pullRequest: {
    id: string;
    number: number;
    title: string;
    state: string;
    isMerged: boolean;
    authorLogin: string;
    baseBranch: string;
    headBranch: string;
    codeReviews: CodeReview[];
  };
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-rust/50 text-rust",
  warning: "border-amber/50 text-amber",
  info: "border-phosphor-dim/50 text-phosphor-dim",
};

export default function PullRequestCard({ pullRequest }: PullRequestCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = pullRequest.codeReviews[0] ?? null;
  const stateLabel = pullRequest.isMerged ? "merged" : pullRequest.state;

  async function handleReview() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pull-requests/${pullRequest.id}/review`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("request failed");
      setExpanded(true);
      // Re-fetch server data so the freshly-created CodeReview row (and its
      // findings) show up — the POST route doesn't return the review itself.
      startTransition(() => router.refresh());
    } catch {
      setError("Review failed to start — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-panel-border bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono-ui text-xs text-paper-dim">
            <span className="text-phosphor">#{pullRequest.number}</span>
            <StatePill state={stateLabel} />
          </div>
          <h3 className="mt-1 truncate text-sm text-paper">{pullRequest.title}</h3>
          <p className="mt-1 truncate font-mono-ui text-[11px] text-paper-dim">
            {pullRequest.authorLogin} · {pullRequest.headBranch} → {pullRequest.baseBranch}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {review && <ReviewStatusPill status={review.status} />}
          <button
            type="button"
            onClick={handleReview}
            disabled={submitting || review?.status === "pending"}
            className="rounded border border-panel-border px-3 py-1.5 font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim transition-colors hover:border-phosphor-dim hover:text-phosphor disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Starting…" : review ? "Re-review" : "Review"}
          </button>
          {review && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-mono-ui text-[11px] text-paper-dim hover:text-phosphor"
              aria-expanded={expanded}
            >
              {expanded ? "Hide ▲" : "Details ▼"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="border-t border-panel-border px-4 py-2 font-mono-ui text-[11px] text-rust">
          {error}
        </p>
      )}

      {expanded && review && (
        <div className="border-t border-panel-border px-4 py-4">
          {review.status === "failed" && (
            <p className="font-mono-ui text-xs text-rust">
              {review.errorMessage ?? "Review failed."}
            </p>
          )}
          {review.status === "pending" && (
            <p className="font-mono-ui text-xs text-paper-dim">Analyzing diff…</p>
          )}
          {review.status === "completed" && (
            <>
              {review.summary && (
                <p className="mb-4 text-sm leading-relaxed text-paper-dim">{review.summary}</p>
              )}
              {review.findings.length === 0 ? (
                <p className="font-mono-ui text-xs text-paper-dim">No findings — clean diff.</p>
              ) : (
                <ul className="space-y-2.5">
                  {review.findings.map((f) => (
                    <li
                      key={f.id}
                      className={`rounded border px-3 py-2.5 ${
                        SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between font-mono-ui text-[10.5px] uppercase tracking-wide">
                        <span>{f.severity}</span>
                        <span className="text-paper-dim">
                          {f.filePath}
                          {f.lineNumber != null ? `:${f.lineNumber}` : ""}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-paper">{f.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
              {review.provider && (
                <p className="mt-4 font-mono-ui text-[10px] uppercase tracking-widest text-paper-dim">
                  {review.provider} / {review.model}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const styles =
    state === "merged"
      ? "text-phosphor-dim"
      : state === "closed"
        ? "text-paper-dim"
        : "text-phosphor";
  return <span className={`uppercase ${styles}`}>{state}</span>;
}

function ReviewStatusPill({ status }: { status: string }) {
  const label = status === "pending" ? "Analyzing…" : status === "failed" ? "Failed" : "Reviewed";
  const styles =
    status === "pending"
      ? "border-amber/50 text-amber"
      : status === "failed"
        ? "border-rust/50 text-rust"
        : "border-phosphor-dim/50 text-phosphor-dim";
  return (
    <span
      className={`rounded border px-2 py-1 font-mono-ui text-[10px] uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}