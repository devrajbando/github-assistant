import Link from "next/link";
import { ghostBtnClass } from "@/lib/ui-classes";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-md border border-panel-border bg-panel shadow-[0_0_60px_rgba(193,80,46,0.06)]">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rust shadow-[0_0_8px_var(--color-rust)]" />
            SIGNAL LOST
          </span>
          <span>ERR 404</span>
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
            <path d="M6 22c4-10 16-10 20 0" />
            <line x1="16" y1="10" x2="16" y2="15" />
            <circle cx="16" cy="18.5" r="1" className="fill-rust" stroke="none" />
            <line x1="5" y1="5" x2="27" y2="27" />
          </svg>

          <h1 className="mb-3 font-display text-lg uppercase tracking-wide">
            Nothing at this address
          </h1>
          <p className="mb-7 text-sm leading-relaxed text-paper-dim">
            This route doesn&rsquo;t exist, or the repository isn&rsquo;t synced to your
            account.
          </p>

          <Link href="/repositories" className={`${ghostBtnClass} inline-flex`}>
            Back to repository index
          </Link>
        </div>
      </div>
    </div>
  );
}