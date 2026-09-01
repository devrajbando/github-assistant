/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type OnboardingStatus =
  | "NOT_GENERATED"
  | "GENERATING"
  | "GENERATED"
  | "FAILED";

type ChecklistItem = {
  id: string;
  order: number;
  key: string;
  category: string | null;
  title: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
};

type OnboardingGuide = {
  id: string;
  status: OnboardingStatus;
  content: string | null;
  provider: string | null;
  model: string | null;
  lastError: string | null;
  generatedAt: string | null;
  checklistItems: ChecklistItem[];
};

type Props = {
  repositoryId: string;
  initialGuide: OnboardingGuide | null;
};

export default function DeveloperOnboarding({
  repositoryId,
  initialGuide,
}: Props) {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<OnboardingGuide | null>(
    initialGuide,
  );
  const [starting, setStarting] = useState(false);

  const fetchGuide = useCallback(async () => {
    const response = await fetch(
      `/api/repositories/${repositoryId}/onboarding`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Unable to read onboarding status.");
    }

    const data = await response.json();

    setGuide(data.guide);
  }, [repositoryId]);

  const generateGuide = useCallback(async () => {
    setStarting(true);

    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/onboarding`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to start onboarding generation.",
        );
      }

      setGuide((current) => ({
        ...(current ?? {
          id: "",
          content: null,
          provider: null,
          model: null,
          lastError: null,
          generatedAt: null,
          checklistItems: [],
        }),
        status: "GENERATING",
      }));
    } catch (error) {
      setGuide((current) => ({
        ...(current ?? {
          id: "",
          content: null,
          provider: null,
          model: null,
          lastError: null,
          generatedAt: null,
          checklistItems: [],
        }),
        status: "FAILED",
        lastError:
          error instanceof Error
            ? error.message
            : "Unable to generate onboarding guide.",
      }));
    } finally {
      setStarting(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    if (!open || guide?.status !== "GENERATING") {
      return;
    }

    const interval = window.setInterval(() => {
      fetchGuide().catch(() => {});
    }, 2000);

    return () => window.clearInterval(interval);
  }, [open, guide?.status, fetchGuide]);

 const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

const toggleChecklist = async (item: ChecklistItem) => {
  if (updatingItemId === item.id) return;

  const previousCompleted = item.isCompleted;
  const nextCompleted = !previousCompleted;

  // Optimistic UI update
  setGuide((current) => {
    if (!current) return current;

    return {
      ...current,
      checklistItems: current.checklistItems.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              isCompleted: nextCompleted,
              completedAt: nextCompleted
                ? new Date().toISOString()
                : null,
            }
          : entry,
      ),
    };
  });

  setUpdatingItemId(item.id);

  try {
    const response = await fetch(
      `/api/repositories/${repositoryId}/onboarding`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: item.id,
          isCompleted: nextCompleted,
        }),
      },
    );

const text = await response.text();

console.log("Checklist response:", {
    status: response.status,
    statusText: response.statusText,
    body: text,
});

let data: any = {};

try {
    data = text ? JSON.parse(text) : {};
} catch {
    throw new Error(`Invalid API response: ${text}`);
}

if (!response.ok) {
    throw new Error(data.error || data.message || "Failed to update checklist");
}

    // Use the server's actual state
    // if (data.item) {
    //   setGuide((current) => {
    //     if (!current) return current;

    //     return {
    //       ...current,
    //       checklistItems: current.checklistItems.map((entry) =>
    //         entry.id === item.id
    //           ? {
    //               ...entry,
    //               isCompleted: data.item.isCompleted,
    //               completedAt: data.item.completedAt,
    //             }
    //           : entry,
    //       ),
    //     };
    //   });
    // }
  } catch (error) {
    // Roll back if API update failed
    setGuide((current) => {
      if (!current) return current;

      return {
        ...current,
        checklistItems: current.checklistItems.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isCompleted: previousCompleted,
                completedAt: item.completedAt,
              }
            : entry,
        ),
      };
    });

    console.error("Checklist update failed:", error);
  } finally {
    setUpdatingItemId(null);
  }
};

  const status = guide?.status ?? "NOT_GENERATED";

  return (
    <section className="rounded-md border border-panel-border bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "GENERATING"
                ? "bg-phosphor shadow-[0_0_8px_var(--color-phosphor)] pulse-dot"
                : status === "FAILED"
                  ? "bg-rust shadow-[0_0_8px_var(--color-rust)]"
                  : status === "GENERATED"
                    ? "bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]"
                    : "bg-paper-dim"
            }`}
          />

          <span className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim">
            DEVELOPER ONBOARDING
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="border border-panel-border px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim transition hover:border-phosphor-dim hover:text-phosphor focus-visible:outline focus-visible:outline-paper focus-visible:outline-offset-2"
        >
          {open ? "HIDE" : "VIEW"}
        </button>
      </div>

      {!open ? null : (
        <div className="p-4 sm:p-5">
          {status === "NOT_GENERATED" && (
            <div className="py-8 text-center">
              <p className="font-display text-sm uppercase tracking-wide text-paper">
                ONBOARDING GUIDE NOT GENERATED
              </p>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-paper-dim">
                Generate an AI-powered guide to help a new developer
                understand this repository and start contributing.
              </p>

              <button
                type="button"
                onClick={generateGuide}
                disabled={starting}
                className="mt-5 border border-amber bg-amber px-4 py-2 font-mono-ui text-[11px] font-bold uppercase tracking-wide text-console transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting
                  ? "STARTING..."
                  : "GENERATE GUIDE →"}
              </button>
            </div>
          )}

          {status === "GENERATING" && (
            <div className="flex items-center gap-3 py-8">
              <span className="h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_8px_var(--color-phosphor)] pulse-dot" />

              <div>
                <p className="font-mono-ui text-xs uppercase tracking-wide text-paper">
                  GENERATING ONBOARDING
                </p>

                <p className="mt-1 text-sm text-paper-dim">
                  Analyzing repository context and preparing developer guidance...
                </p>
              </div>
            </div>
          )}

          {status === "FAILED" && (
            <div className="border border-rust/40 bg-rust/5 p-4">
              <p className="font-mono-ui text-[11px] uppercase tracking-wide text-rust">
                ONBOARDING GENERATION FAILED
              </p>

              <p className="mt-2 wrap-break-word text-sm leading-6 text-paper-dim">
                {guide?.lastError ?? "Unknown generation error."}
              </p>

              <button
                type="button"
                onClick={generateGuide}
                disabled={starting}
                className="mt-4 border border-panel-border px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim transition hover:border-phosphor-dim hover:text-phosphor disabled:opacity-50"
              >
                {starting
                  ? "RETRYING..."
                  : "RETRY GENERATION"}
              </button>
            </div>
          )}

          {status === "GENERATED" && guide?.content && (
            <>
              {/* Guide */}
              <div className="prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h2 className="mb-4 mt-9 border-b border-panel-border pb-2 text-lg font-semibold text-paper first:mt-0 sm:text-xl">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h3 className="mb-3 mt-7 text-base font-semibold text-paper sm:text-lg">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="mb-2 mt-5 text-sm font-semibold text-paper sm:text-base">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 text-[15px] leading-7 text-paper">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-4 ml-5 list-disc space-y-1.5 marker:text-phosphor-dim/70">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-4 ml-5 list-decimal space-y-1.5 marker:text-phosphor-dim/70">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-[15px] leading-7 text-paper">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-paper">{children}</strong>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-phosphor underline decoration-phosphor-dim underline-offset-2 hover:text-phosphor"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ className, children }) => {
                      // Fenced code blocks get a language- className from
                      // remark; inline code doesn't. Different styling for
                      // each — a block needs its own <pre> treatment, not
                      // the tight inline-code pill.
                      const isBlock = Boolean(className);
                      if (isBlock) {
                        return (
                          <code className={`font-mono text-[13px] leading-6 text-paper ${className ?? ""}`}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className="rounded border border-panel-border bg-console px-1.5 py-0.5 font-mono text-[13px] text-phosphor">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="mb-4 overflow-x-auto rounded-md border border-panel-border bg-console p-4">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {guide.content}
                </ReactMarkdown>
              </div>

              {/* Checklist */}
              {guide.checklistItems.length > 0 && (
                <section className="mt-8 border-t border-panel-border pt-6">
                  <div className="mb-4">
                    <p className="text-base font-semibold text-paper">Onboarding checklist</p>

                    <p className="mt-1 text-sm text-paper-dim">
                      Track your progress through the repository.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {guide.checklistItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleChecklist(item)}
                        disabled={updatingItemId === item.id}
                        className={`group flex w-full items-start gap-3 rounded border border-panel-border p-3.5 text-left transition hover:border-phosphor-dim disabled:cursor-wait disabled:opacity-70 ${
                        updatingItemId === item.id ? "cursor-wait" : ""
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                            item.isCompleted
                              ? "border-phosphor bg-phosphor text-console"
                              : "border-panel-border"
                          }`}
                        >
                          {item.isCompleted && "✓"}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium ${
                              item.isCompleted
                                ? "text-phosphor line-through"
                                : "text-paper"
                            }`}
                          >
                            {item.title}
                          </span>

                          {item.description && (
                            <span className="mt-1 block text-sm leading-6 text-paper-dim">
                              {item.description}
                            </span>
                          )}

                          {item.category && (
                            <span className="mt-2 inline-flex items-center rounded-full border border-panel-border px-2 py-0.5 font-mono-ui text-[10px] uppercase tracking-wide text-phosphor-dim">
                              {item.category}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {guide.generatedAt && (
                <div className="mt-6 border-t border-panel-border pt-3 font-mono-ui text-[10.5px] text-paper-dim">
                  Generated {new Date(guide.generatedAt).toLocaleString()}
                  {guide.provider && <> · {guide.provider.toUpperCase()}</>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}