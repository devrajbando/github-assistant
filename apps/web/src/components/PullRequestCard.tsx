"use client";

import { useState } from "react";

interface Finding {
  id: string;
  filePath: string;
  lineNumber: number | null;
  severity: string;
  comment: string;
}

interface Review {
  id: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  findings: Finding[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
};

export function PullRequestCard({
  pullRequestId,
  number,
  title,
  state,
  isMerged,
  initialReview,
}: {
  pullRequestId: string;
  number: number;
  title: string;
  state: string;
  isMerged: boolean;
  initialReview: Review | null;
}) {
  const [review, setReview] = useState<Review | null>(initialReview);
  const [isReviewing, setIsReviewing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleReview() {
    setIsReviewing(true);
    try {
      const res = await fetch(`/api/pull-requests/${pullRequestId}/review`, {
        method: "POST",
      });
      const data = await res.json();
      setReview(data);
      setExpanded(true);
    } catch {
      setReview({
        id: "local-error",
        status: "failed",
        summary: null,
        errorMessage: "Request failed. Please try again.",
        findings: [],
      });
      setExpanded(true);
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-900">
          #{number} {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {isMerged ? "merged" : state}
          </span>
          <button
            onClick={handleReview}
            disabled={isReviewing}
            className="rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isReviewing ? "Reviewing…" : review ? "Re-review" : "Review"}
          </button>
          {review && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-gray-500 hover:underline"
            >
              {expanded ? "Hide" : "Show"}
            </button>
          )}
        </div>
      </div>

      {review && expanded && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
          {review.status === "failed" ? (
            <p className="text-sm text-red-600">Review failed: {review.errorMessage}</p>
          ) : review.status === "pending" ? (
            <p className="text-sm text-gray-500">Review in progress…</p>
          ) : (
            <>
              {review.summary && <p className="text-sm text-gray-800 mb-3">{review.summary}</p>}
              {review.findings.length === 0 ? (
                <p className="text-sm text-gray-500">No issues found.</p>
              ) : (
                <ul className="space-y-2">
                  {review.findings.map((f) => (
                    <li key={f.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-xs font-medium " +
                            (SEVERITY_STYLES[f.severity] ?? "bg-gray-100 text-gray-600")
                          }
                        >
                          {f.severity}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          {f.filePath}
                          {f.lineNumber != null ? `:${f.lineNumber}` : ""}
                        </span>
                      </div>
                      <p className="text-gray-700">{f.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}