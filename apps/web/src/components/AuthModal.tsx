"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { rockerBtnClass } from "@/lib/ui-classes";

type AuthModalProps = {
  signInAction: () => Promise<void>;
  message?: string;
};

export default function AuthModal({ signInAction, message }: AuthModalProps) {
  const signInBtnRef = useRef<HTMLButtonElement>(null);
  const homeLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    signInBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
        return;
      }
      if (e.key !== "Tab") return;

      const first = signInBtnRef.current;
      const last = homeLinkRef.current;
      if (!first || !last) return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-console/80 backdrop-blur-sm" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
        className="relative w-full max-w-sm rounded-md border border-panel-border bg-panel shadow-[0_0_60px_rgba(61,255,143,0.08)]"
      >
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rust shadow-[0_0_8px_var(--color-rust)]" />
            ACCESS CONTROL
          </span>
          <span>ERR 401</span>
        </div>

        <div className="px-6 py-8 text-center">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto mb-5 h-9 w-9 stroke-amber"
            aria-hidden="true"
          >
            <rect x="7" y="14" width="18" height="13" rx="2" />
            <path d="M11 14v-4a5 5 0 0110 0v4" />
            <circle cx="16" cy="20" r="1.5" className="fill-amber" stroke="none" />
            <line x1="16" y1="21.5" x2="16" y2="24" />
          </svg>

          <h2 id="auth-modal-title" className="mb-3 font-display text-lg uppercase tracking-wide">
            Authentication required
          </h2>
          <p id="auth-modal-desc" className="mb-7 text-sm leading-relaxed text-paper-dim">
            {message ?? "This console is locked to your synced repositories. Sign in with GitHub to continue."}
          </p>

          <form action={signInAction}>
            <button
              ref={signInBtnRef}
              type="submit"
              className={`${rockerBtnClass} w-full justify-center`}
            >
              <span className="h-2 w-2 rounded-full bg-console" />
              Authenticate via GitHub
            </button>
          </form>

          <Link
            ref={homeLinkRef}
            href="/"
            className="mt-4 inline-block font-mono-ui text-xs text-paper-dim underline decoration-panel-border underline-offset-4 hover:text-phosphor"
          >
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}