/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import { rockerBtnClass } from "@/lib/ui-classes";
import { useIndexStatus } from "@/lib/index-status-content";

type DiagramStatus = "pending" | "completed" | "failed";

type Diagram = {
  id: string;
  status: DiagramStatus;
  summary: string | null;
  mermaidCode: string | null;
  sourceIndexRunId: string | null;
  errorMessage: string | null;
};

type Props = {
  repositoryId: string;
  initialDiagram: Diagram | null;
};

export default function ArchitectureDiagramPanel({
  repositoryId,
  initialDiagram,
}: Props) {
  const { status: indexStatus, currentIndexRunId } = useIndexStatus();
  const [diagram, setDiagram] = useState<Diagram | null>(initialDiagram);
  const [generating, setGenerating] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Match DeveloperOnboarding's VIEW/HIDE behavior.
  // Existing completed diagrams start visible.
  const [open, setOpen] = useState(
    initialDiagram?.status === "completed"
  );

  const diagramRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  if (!diagram?.mermaidCode || diagram.status !== "completed") {
    return;
  }

  // Capture narrowed values before entering the async closure.
  const mermaidCode = diagram.mermaidCode;
  const diagramId = diagram.id;

  let cancelled = false;
  setRenderError(null);

  (async () => {
    const mermaid = (await import("mermaid")).default;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "strict",

    });

    try {
     const { svg } = await mermaid.render(
  `diagram-${diagramId}`,
  mermaidCode
);

if (!cancelled && diagramRef.current) {
  diagramRef.current.innerHTML = svg;
}

    } catch {
      if (!cancelled) {
        setRenderError(
          "The model's diagram wasn't valid Mermaid syntax — try regenerating."
        );
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [diagram]);

  async function handleGenerate() {
    setGenerating(true);
    setRequestError(null);

    try {
      const res = await fetch(
        `/api/repositories/${repositoryId}/diagram`,
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ?? "Diagram generation failed"
        );
      }

      setDiagram(data.diagram);

      // Newly generated diagram should be visible.
      setOpen(true);
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : "Diagram generation failed"
      );
    } finally {
      setGenerating(false);
    }
  }

  const isStale = Boolean(
    diagram?.status === "completed" &&
      diagram.sourceIndexRunId &&
      currentIndexRunId &&
      diagram.sourceIndexRunId !== currentIndexRunId
  );

  const isGenerated = diagram?.status === "completed";

  if (indexStatus !== "INDEXED") {
    return (
      <section className="rounded-md border border-panel-border bg-panel p-4">
        <p className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim">
          ARCHITECTURE DIAGRAM
        </p>

        <p className="mt-2 font-mono-ui text-[10px] text-paper-dim">
          Index this repository first to generate an architecture diagram.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-panel-border bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              generating
                ? "bg-phosphor shadow-[0_0_8px_var(--color-phosphor)] pulse-dot"
                : diagram?.status === "failed"
                  ? "bg-rust shadow-[0_0_8px_var(--color-rust)]"
                  : isGenerated
                    ? "bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]"
                    : "bg-paper-dim"
            }`}
          />

          <span className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim">
            ARCHITECTURE DIAGRAM
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* VIEW / HIDE
              Only available once a diagram has been generated. */}
          {isGenerated && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="border border-panel-border px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim transition hover:border-phosphor-dim hover:text-phosphor focus-visible:outline focus-visible:outline-paper focus-visible:outline-offset-2"
              aria-expanded={open}
            >
              {open ? "HIDE" : "VIEW"}
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            aria-busy={generating}
            className={`${rockerBtnClass} ${
              generating
                ? "cursor-wait opacity-70 hover:shadow-none"
                : ""
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full bg-console ${
                generating ? "pulse-dot" : ""
              }`}
              aria-hidden="true"
            />

            {generating
              ? "Generating…"
              : diagram
                ? "Regenerate"
                : "Generate diagram"}
          </button>
        </div>
      </div>

      {/* Content */}
<div className={`p-4 sm:p-5 ${open ? "" : "hidden"}`}>
  {requestError && (
    <p className="mb-3 font-mono-ui text-[10.5px] text-rust">
      {requestError}
    </p>
  )}

  {!diagram && !generating && (
    <p className="font-mono-ui text-[10px] text-paper-dim">
      No diagram generated yet. This samples code across the repo via
      semantic search and asks the model for a high-level view — a
      summary of the shape of the system, not exact static analysis.
    </p>
  )}

  {diagram?.status === "failed" && (
    <p className="font-mono-ui text-[10.5px] text-rust">
      {diagram.errorMessage ?? "Diagram generation failed."}
    </p>
  )}

  {isStale && (
    <p className="mb-3 font-mono-ui text-[10.5px] text-amber">
      This diagram was generated from an earlier index of this repo —
      regenerate to reflect the latest indexed code.
    </p>
  )}

  {isGenerated && (
    <>
      {diagram.summary && (
        <p className="mb-4 text-sm leading-relaxed text-paper-dim">
          {diagram.summary}
        </p>
      )}

      {renderError && (
        <p className="mb-3 font-mono-ui text-[10.5px] text-rust">
          {renderError}
        </p>
      )}

      {/* Keep this mounted so Mermaid SVG survives VIEW/HIDE */}
      <div
        ref={diagramRef}
        className="overflow-x-auto"
      />
    </>
  )}
</div>

      {/* Same collapsed-state treatment as DeveloperOnboarding */}
      {isGenerated && !open && (
        <div className="px-4 py-3 font-mono-ui text-[9px] uppercase tracking-wide text-paper-dim">
          ARCHITECTURE HIDDEN — CLICK VIEW TO DISPLAY DIAGRAM.
        </div>
      )}
    </section>
  );
}