"use client";

import { useEffect } from "react";
import { ghostBtnClass } from "@/lib/ui-classes";

export default function RepositoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-md border border-panel-border bg-panel shadow-[0_0_60px_rgba(193,80,46,0.06)]">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rust shadow-[0_0_8px_var(--color-rust)]" />
            SYSTEM FAULT
          </span>
          <span>ERR 500</span>
        </div>

        <div className="px-6 py-10">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-5 h-9 w-9 stroke-rust"
            aria-hidden="true"
          >
            <path d="M16 6l12 20H4L16 6z" />
            <line x1="16" y1="15" x2="16" y2="19" />
            <circle cx="16" cy="22.5" r="1" className="fill-rust" stroke="none" />
          </svg>

          <h1 className="mb-3 font-display text-lg uppercase tracking-wide">
            Something broke
          </h1>
          <p className="mb-7 text-sm leading-relaxed text-paper-dim">
            {error.message || "An unexpected error interrupted this request."}
          </p>

          <button type="button" onClick={() => reset()} className={ghostBtnClass}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}