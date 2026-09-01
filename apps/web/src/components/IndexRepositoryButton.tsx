"use client";

import { useEffect, useRef, useState } from "react";
import { rockerBtnClass } from "@/lib/ui-classes";
import { useIndexStatus } from "@/lib/index-status-content";
import type { IndexStatus } from "@/lib/index-repository";

type IndexRepositoryButtonProps = {
  repositoryId: string;
  initialError?: string | null;
};

const POLL_INTERVAL_MS = 4000;

const LABELS: Record<IndexStatus, string> = {
  NOT_INDEXED: "Index repository",
  INDEXING: "Indexing…",
  INDEXED: "Re-index",
  FAILED: "Retry indexing",
};

// Sync is cheap, frequent, and low-risk, so it keeps the bold primary
// look. Indexing can take minutes and is heavier on the backend — once
// a repo already has an index, re-running it is optional, so that state
// steps down to a quieter outline instead of matching Sync's prominence.
// A failed run gets flagged rather than blending back in.
const VARIANT_CLASS: Record<IndexStatus, string> = {
  NOT_INDEXED: "",
  INDEXING: "",
  INDEXED:
    "!bg-transparent !text-paper-dim !shadow-none border !border-panel-border hover:!text-paper hover:!border-paper-dim",
  FAILED: "!border-rust !text-rust",
};

export default function IndexRepositoryButton({
  repositoryId,
  initialError = null,
}: IndexRepositoryButtonProps) {
  // status/lastIndexedAt now live in shared context — this button is the
  // only thing that writes to it, but ArchitectureDiagramPanel and
  // RepoSearch read the same value, so they update the moment this does.
  const { status, lastIndexedAt, setIndexState } = useIndexStatus();
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialStatusRef = useRef(status);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/repositories/${repositoryId}/index`);
        if (!res.ok) return;
        const data = await res.json();
        setIndexState({
          status: data.status,
          lastIndexedAt: data.lastIndexedAt,
          currentIndexRunId: data.activeIndexRunId,
        });
        setError(data.lastIndexError);
        if (data.status !== "INDEXING") stopPolling();
      } catch {
        // Transient network hiccup — the next tick retries on its own.
      }
    }, POLL_INTERVAL_MS);
  }

  // A page load can land mid-run — e.g. this button kicked off indexing
  // before a refresh, or another tab/session started it. Resume polling
  // so the UI catches up instead of showing a stale "Indexing…" forever.
  useEffect(() => {
    if (initialStatusRef.current === "INDEXING") startPolling();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    if (status === "INDEXING" || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/index`, { method: "POST" });
      if (res.status === 202) {
        setIndexState({ status: "INDEXING" });
        startPolling();
      } else {
        const data = await res.json().catch(() => ({}));
        if (typeof data.error === "string" && data.error.includes("already in progress")) {
          // Beaten to it by another trigger — fall in behind that run
          // rather than surfacing this as a failure.
          setIndexState({ status: "INDEXING" });
          startPolling();
        } else {
          setIndexState({ status: "FAILED" });
          setError(typeof data.error === "string" ? data.error : "Failed to start indexing");
        }
      }
    } catch {
      setIndexState({ status: "FAILED" });
      setError("Failed to reach the server");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pending = status === "INDEXING" || isSubmitting;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className={`relative overflow-hidden ${rockerBtnClass} ${VARIANT_CLASS[status]} ${
          pending ? "cursor-wait opacity-70 hover:shadow-none" : ""
        }`}
      >
        {pending && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-console pulse-dot"
            aria-hidden="true"
          />
        )}
        {LABELS[status]}

        {pending && (
          <span
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-console/20"
            aria-hidden="true"
          >
            <span className="progress-sweep block h-full w-1/3 rounded-full bg-console" />
          </span>
        )}
      </button>

      {status === "FAILED" && error && (
        <p className="max-w-[32ch] text-right font-mono-ui text-[10.5px] text-rust">{error}</p>
      )}

      {status === "INDEXED" && lastIndexedAt && (
        <p className="font-mono-ui text-[10.5px] text-paper-dim">
          Indexed {new Date(lastIndexedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}