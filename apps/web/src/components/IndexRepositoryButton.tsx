"use client";

import { useEffect, useRef, useState } from "react";
import { rockerBtnClass } from "@/lib/ui-classes";
import type { IndexStatus } from "@/lib/index-repository";

type IndexRepositoryButtonProps = {
  repositoryId: string;
  initialStatus: IndexStatus;
  initialLastIndexedAt?: string | null;
  initialError?: string | null;
};

const POLL_INTERVAL_MS = 4000;

const LABELS: Record<IndexStatus, string> = {
  NOT_INDEXED: "Index repository",
  INDEXING: "Indexing…",
  INDEXED: "Re-index",
  FAILED: "Retry indexing",
};

export default function IndexRepositoryButton({
  repositoryId,
  initialStatus,
  initialLastIndexedAt = null,
  initialError = null,
}: IndexRepositoryButtonProps) {
  const [status, setStatus] = useState<IndexStatus>(initialStatus);
  const [lastIndexedAt, setLastIndexedAt] = useState<string | null>(initialLastIndexedAt);
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setStatus(data.status);
        setLastIndexedAt(data.lastIndexedAt);
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
    if (initialStatus === "INDEXING") startPolling();
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
        setStatus("INDEXING");
        startPolling();
      } else {
        const data = await res.json().catch(() => ({}));
        if (typeof data.error === "string" && data.error.includes("already in progress")) {
          // Beaten to it by another trigger — fall in behind that run
          // rather than surfacing this as a failure.
          setStatus("INDEXING");
          startPolling();
        } else {
          setStatus("FAILED");
          setError(typeof data.error === "string" ? data.error : "Failed to start indexing");
        }
      }
    } catch {
      setStatus("FAILED");
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
        className={`${rockerBtnClass} ${pending ? "cursor-wait opacity-70 hover:shadow-none" : ""}`}
      >
        <span
          className={`h-2 w-2 rounded-full bg-console ${pending ? "pulse-dot" : ""}`}
          aria-hidden="true"
        />
        {LABELS[status]}
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