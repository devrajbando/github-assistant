import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import ConsoleReadout from "@/components/ConsoleReadout";
import { rockerBtnClass as rockerBtn, ghostBtnClass as ghostBtn } from "@/lib/ui-classes";
async function signInWithGitHub() {
  "use server";
  await signIn("github");
}

async function signOutOfGitHub() {
  "use server";
  await signOut();
}


const FEATURES = [
  {
    label: "Sync-engine",
    title: "Sync-engine",
    description:
      "Pulls every repo, pull request, and issue into Postgres, so nothing waits on a live GitHub call.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3.5 h-7.5 w-7.5 stroke-phosphor">
        <ellipse cx="16" cy="16" rx="12" ry="6" transform="rotate(-20 16 16)" />
        <ellipse cx="16" cy="16" rx="12" ry="6" transform="rotate(20 16 16)" />
        <circle cx="16" cy="16" r="2" className="fill-phosphor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Ai-copilot",
    title: "Ai-copilot",
    description:
      "Ask a repo a question and get an answer grounded in its real pull requests and issues, not a guess.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" strokeWidth={1.5} strokeLinecap="round" className="mb-3.5 h-7.5 w-7.5 stroke-phosphor">
        <circle cx="16" cy="16" r="3" />
        <circle cx="16" cy="16" r="8" opacity="0.55" />
        <circle cx="16" cy="16" r="13" opacity="0.28" />
        <line x1="16" y1="16" x2="24" y2="8" />
      </svg>
    ),
  },
  {
    label: "Code-review",
    title: "Code-review",
    description:
      "On-demand review of any pull request. Per-file, per-line findings, ranked by severity.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3.5 h-7.5 w-7.5 stroke-phosphor">
        <rect x="5" y="6" width="22" height="20" rx="2" />
        <line x1="10" y1="12" x2="18" y2="12" />
        <line x1="10" y1="16" x2="22" y2="16" />
        <line x1="10" y1="20" x2="15" y2="20" />
        <path d="M19 19.5l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Token-vault",
    title: "Token-vault",
    description:
      "GitHub tokens encrypted at rest with AES-256-GCM. Nothing touches the database in plaintext.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="mb-3.5 h-7.5 w-7.5 stroke-phosphor">
        <rect x="7" y="14" width="18" height="13" rx="2" />
        <path d="M11 14v-4a5 5 0 0110 0v4" />
        <circle cx="16" cy="20" r="1.5" className="fill-phosphor" stroke="none" />
        <line x1="16" y1="21.5" x2="16" y2="24" />
      </svg>
    ),
  },
];

const TECH = ["NEXT.JS", "TYPESCRIPT", "POSTGRESQL", "PRISMA", "DOCKER", "GITHUB OAUTH"];

export default async function Home() {
  const session = await auth();

  return (
    <>
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
        <div>
          <p className="mb-5 font-mono-ui text-sm text-phosphor">
            $ ./boot github-assistant.sys
            <span className="cursor-blink ml-1 inline-block h-3.5 w-1.75 align-[-2px] bg-phosphor" />
          </p>

          <h1 className="mb-6 font-display text-4xl font-bold uppercase leading-[1.1] sm:text-5xl lg:text-6xl">
            Repository intelligence,{" "}
            <span className="text-phosphor [text-shadow:0_0_6px_rgba(61,255,143,0.22)]">
              online.
            </span>
          </h1>

          <p className="mb-9 max-w-[46ch] text-base leading-relaxed text-paper-dim">
            Every pull request, issue, and commit — synced to Postgres, explained
            by an AI that reads your actual repo data, and reviewed line by line
            before you merge.
          </p>

          {session && (
            <p className="mb-4 font-mono-ui text-xs text-paper-dim">
              SIGNED IN AS{" "}
              <span className="text-phosphor">{session.user?.email}</span>
            </p>
          )}

          {session ? (
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/repositories" className={rockerBtn}>
                <span className="h-2 w-2 rounded-full bg-console" />
                View repositories
              </Link>
              <form action={signOutOfGitHub}>
                <button type="submit" className={ghostBtn}>
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <form action={signInWithGitHub}>
              <button type="submit" className={rockerBtn}>
                <span className="h-2 w-2 rounded-full bg-console" />
                Authenticate via GitHub
              </button>
            </form>
          )}
        </div>

        <div className="rounded-md border border-panel-border bg-panel shadow-[0_0_44px_rgba(61,255,143,0.05)]">
          <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
            <span className="flex items-center gap-2">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]" />
              LIVE READOUT
            </span>
            <span>PID 4471</span>
          </div>
          <div className="min-h-55 px-4 py-5">
            <ConsoleReadout />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 pb-20 sm:grid-cols-2 sm:px-12 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-md border border-panel-border bg-panel p-6 transition-colors hover:border-phosphor-dim hover:shadow-[0_0_26px_rgba(61,255,143,0.08)]"
          >
            <div className="mb-4 flex items-center gap-2 font-mono-ui text-[10.5px] uppercase tracking-widest text-paper-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_6px_var(--color-phosphor)]" />
              {f.label}
            </div>
            {f.icon}
            <h3 className="mb-2.5 font-display text-[14.5px] uppercase tracking-wide">
              {f.title}
            </h3>
            <p className="text-[13.5px] leading-relaxed text-paper-dim">
              {f.description}
            </p>
          </div>
        ))}
      </section>

      <section className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-6 pb-16 sm:px-12">
        {TECH.map((t) => (
          <div
            key={t}
            className="flex items-center gap-2 rounded border border-panel-border bg-panel px-3.5 py-2 font-mono-ui text-[11px] tracking-wide text-paper-dim"
          >
            <span className="h-1.25 w-1.25 rounded-full bg-phosphor shadow-[0_0_6px_var(--color-phosphor)]" />
            {t}
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-24 text-center sm:px-12">
        <h2 className="mb-4 font-display text-2xl uppercase leading-snug sm:text-3xl">
          Stop tab-switching to understand your own repos.
        </h2>
        <p className="mb-8 text-[15px] text-paper-dim">
          Sign in once. Every synced repository gets a live chat and an
          on-demand reviewer.
        </p>
        {session ? (
          <Link href="/repositories" className={rockerBtn}>
            <span className="h-2 w-2 rounded-full bg-console" />
            View repositories
          </Link>
        ) : (
          <form action={signInWithGitHub}>
            <button type="submit" className={rockerBtn}>
              <span className="h-2 w-2 rounded-full bg-console" />
              Authenticate via GitHub
            </button>
          </form>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-border px-6 py-5 font-mono-ui text-[11px] text-paper-dim sm:px-12">
        <div className="flex items-center gap-2">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_6px_var(--color-phosphor)]" />
          SYSTEM STATUS: ONLINE
        </div>
        <div>BUILD 2026.08 — MISSION CONTROL EDITION</div>
      </footer>
    </>
  );
}