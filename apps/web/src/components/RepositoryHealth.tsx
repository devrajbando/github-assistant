"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type HealthStatus = "NOT_COMPUTED" | "COMPUTING" | "COMPUTED" | "FAILED";

type HealthScore = {
  overallScore: number;

  securityScore: number | null;  
  vulnerabilityCriticalCount: number;
  vulnerabilityHighCount: number;
  vulnerabilityModerateCount: number;
  vulnerabilityLowCount: number;

  complexityScore: number;
  avgCyclomaticComplexity: number;
  highComplexityFileCount: number;

  documentationScore: number;
  documentedExportRatio: number;
  hasReadme: boolean;

  activityScore: number;
  commitsLast90Days: number;
  prMergeRate: number | null;

  computedAt: string;
};

type HealthResponse = {
  status: HealthStatus;
  lastHealthComputedAt: string | null;
  lastHealthError: string | null;
  score: HealthScore | null;
};

interface RepositoryHealthProps {
  repositoryId: string;
  initialStatus: HealthStatus;
  initialComputedAt: string | null;
  initialError: string | null;
  initialScore: HealthScore | null;
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      label: "HEALTHY",
      color: "text-phosphor",
      border: "border-phosphor-dim",
      bg: "bg-phosphor/5",
    };
  }

  if (score >= 60) {
    return {
      label: "STABLE",
      color: "text-amber",
      border: "border-amber/40",
      bg: "bg-amber/5",
    };
  }

  return {
    label: "NEEDS ATTENTION",
    color: "text-rust",
    border: "border-rust/40",
    bg: "bg-rust/5",
  };
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MetricBar({
  label,
  score,
  description,
}: {
  label: string;
  score: number | null;
  description: string;
}) {
  if (score === null) {
    return (
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono-ui text-[11px] uppercase tracking-wide text-paper">
              {label}
            </p>
            <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
              {description}
            </p>
          </div>
          <span className="font-display text-lg text-paper-dim">N/A</span>
        </div>
        <div className="h-1.5 overflow-hidden bg-console">
          <div className="h-full w-full border-t border-dashed border-panel-border" />
        </div>
      </div>
    );
  }
  const tone = scoreTone(score);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono-ui text-[11px] uppercase tracking-wide text-paper">
            {label}
          </p>
          <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
            {description}
          </p>
        </div>

        <span className={`font-display text-lg ${tone.color}`}>
          {score}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden bg-console">
        <div
          className={`h-full transition-all duration-500 ${
            score >= 80
              ? "bg-phosphor"
              : score >= 60
                ? "bg-amber"
                : "bg-rust"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  tone = "text-paper",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="border-l border-panel-border pl-3">
      <p className="font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim">
        {label}
      </p>
      <p className={`mt-1 font-mono-ui text-sm ${tone}`}>{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 px-4 py-8">
      <span className="h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_8px_var(--color-phosphor)] pulse-dot" />

      <div>
        <p className="font-mono-ui text-xs uppercase tracking-wide text-paper">
          ANALYZING REPOSITORY
        </p>

        <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
          Scanning source, dependencies, documentation and activity…
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  onCompute,
  computing,
}: {
  onCompute: () => void;
  computing: boolean;
}) {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-panel-border bg-console">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 text-paper-dim"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 3v18M3 12h18" />
          </svg>
        </div>

        <p className="mt-4 font-display text-sm uppercase tracking-wide text-paper">
          Health profile unavailable
        </p>

        <p className="mt-2 font-mono-ui text-[10px] leading-5 text-paper-dim">
          Run a repository analysis to calculate security, complexity,
          documentation and activity metrics.
        </p>

        <button
          type="button"
          onClick={onCompute}
          disabled={computing}
          className="mt-5 border border-amber bg-amber px-4 py-2 font-mono-ui text-[11px] font-bold uppercase tracking-wide text-console transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2"
        >
          {computing ? "STARTING…" : "RUN ANALYSIS →"}
        </button>
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
  computing,
}: {
  error: string;
  onRetry: () => void;
  computing: boolean;
}) {
  return (
    <div className="px-4 py-6">
      <div className="border border-rust/40 bg-rust/5 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rust shadow-[0_0_8px_var(--color-rust)]" />

          <div className="min-w-0 flex-1">
            <p className="font-mono-ui text-[11px] uppercase tracking-wide text-rust">
              HEALTH COMPUTATION FAILED
            </p>

            <p className="mt-2 break-words font-mono-ui text-[10px] leading-5 text-paper-dim">
              {error}
            </p>

            <button
              type="button"
              onClick={onRetry}
              disabled={computing}
              className="mt-4 border border-panel-border px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim transition hover:border-phosphor-dim hover:text-phosphor disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2"
            >
              {computing ? "RETRYING…" : "RETRY ANALYSIS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthContent({ score }: { score: HealthScore }) {
  const tone = scoreTone(score.overallScore);

  return (
    <div className="p-4 sm:p-5">
      {/* Score + summary */}
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div
          className={`flex min-h-[190px] flex-col items-center justify-center border ${tone.border} ${tone.bg}`}
        >
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-paper-dim">
            OVERALL
          </span>

          <div className={`mt-2 font-display text-6xl ${tone.color}`}>
            {score.overallScore}
          </div>

          <span
            className={`mt-2 font-mono-ui text-[10px] uppercase tracking-wide ${tone.color}`}
          >
            {tone.label}
          </span>

          <div className="mt-4 h-px w-24 bg-panel-border" />

          <span className="mt-3 font-mono-ui text-[9px] uppercase tracking-wide text-paper-dim">
            / 100
          </span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <MetricBar
            label="Security"
            score={score.securityScore}
            description="Dependency vulnerabilities"
          />

          <MetricBar
            label="Complexity"
            score={score.complexityScore}
            description="Cyclomatic complexity"
          />

          <MetricBar
            label="Documentation"
            score={score.documentationScore}
            description="README + exported symbols"
          />

          <MetricBar
            label="Activity"
            score={score.activityScore}
            description="Commits + PR merge rate"
          />
        </div>
      </div>

      {/* Security */}
     
<section className="mt-6 border-t border-panel-border pt-5">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <p className="font-display text-xs uppercase tracking-wide text-paper">SECURITY</p>
      <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
        Dependency vulnerability profile
      </p>
    </div>
    <span className="font-mono-ui text-[10px] text-paper-dim">npm audit</span>
  </div>

  {score.securityScore === null ? (
    <p className="font-mono-ui text-[10px] leading-5 text-paper-dim">
      No package-lock.json found — dependency audit not applicable to this repository.
    </p>
  ) : (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* existing four DetailStat blocks, unchanged */}
    </div>
  )}
</section>

      {/* Complexity */}
      <section className="mt-6 border-t border-panel-border pt-5">
        <div className="mb-4">
          <p className="font-display text-xs uppercase tracking-wide text-paper">
            COMPLEXITY
          </p>

          <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
            Source-level decision density
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailStat
            label="Avg. cyclomatic"
            value={score.avgCyclomaticComplexity.toFixed(1)}
          />

          <DetailStat
            label="High-complexity files"
            value={score.highComplexityFileCount}
            tone={
              score.highComplexityFileCount > 0
                ? "text-amber"
                : "text-phosphor"
            }
          />
        </div>
      </section>

      {/* Documentation */}
      <section className="mt-6 border-t border-panel-border pt-5">
        <div className="mb-4">
          <p className="font-display text-xs uppercase tracking-wide text-paper">
            DOCUMENTATION
          </p>

          <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
            Export coverage and project documentation
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailStat
            label="Documented exports"
            value={formatPercent(score.documentedExportRatio)}
          />

          <DetailStat
            label="README"
            value={score.hasReadme ? "PRESENT" : "MISSING"}
            tone={score.hasReadme ? "text-phosphor" : "text-amber"}
          />
        </div>
      </section>

      {/* Activity */}
      <section className="mt-6 border-t border-panel-border pt-5">
        <div className="mb-4">
          <p className="font-display text-xs uppercase tracking-wide text-paper">
            ACTIVITY
          </p>

          <p className="mt-1 font-mono-ui text-[10px] text-paper-dim">
            Recent repository development activity
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailStat
            label="Commits / 90d"
            value={score.commitsLast90Days}
          />

          <DetailStat
            label="PR merge rate"
            value={
              score.prMergeRate === null
                ? "N/A"
                : formatPercent(score.prMergeRate)
            }
          />
        </div>
      </section>
    </div>
  );
}

export default function RepositoryHealth({
  repositoryId,
  initialStatus,
  initialComputedAt,
  initialError,
  initialScore,
}: RepositoryHealthProps) {
    const [isExpanded, setIsExpanded] = useState(true);
  const [status, setStatus] = useState<HealthStatus>(initialStatus);
  const [score, setScore] = useState<HealthScore | null>(initialScore);
  const [computedAt, setComputedAt] = useState<string | null>(
    initialComputedAt,
  );
  const [error, setError] = useState<string | null>(initialError);
  const [starting, setStarting] = useState(false);

  const fetchHealth = useCallback(async () => {
    const response = await fetch(
      `/api/repositories/${repositoryId}/health`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Unable to read repository health status.");
    }

    const data: HealthResponse = await response.json();

    setStatus(data.status);
    setScore(data.score);
    setComputedAt(data.lastHealthComputedAt);
    setError(data.lastHealthError);
  }, [repositoryId]);

  const startComputation = useCallback(async () => {
    setStarting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/health`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to start health analysis.");
      }

      setStatus("COMPUTING");
    } catch (err) {
      setStatus("FAILED");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start health analysis.",
      );
    } finally {
      setStarting(false);
    }
  }, [repositoryId]);

  // Poll only while the backend job is running.
  useEffect(() => {
    if (status !== "COMPUTING") return;

    const interval = window.setInterval(() => {
      fetchHealth().catch(() => {
        // Keep polling. A transient GET failure should not terminate
        // the running health job UI.
      });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [status, fetchHealth]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "COMPUTING":
        return "ANALYZING";

      case "COMPUTED":
        return "COMPUTED";

      case "FAILED":
        return "FAILED";

      default:
        return "NOT COMPUTED";
    }
  }, [status]);

  const statusColor =
    status === "COMPUTING"
      ? "phosphor"
      : status === "FAILED"
        ? "rust"
        : score
          ? scoreTone(score.overallScore).color.includes("phosphor")
            ? "phosphor"
            : "amber"
          : "paper-dim";

  return (
    <section className="rounded-md border border-panel-border bg-panel">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
        <div className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              statusColor === "phosphor"
                ? "bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]"
                : statusColor === "amber"
                  ? "bg-amber shadow-[0_0_8px_var(--color-amber)]"
                  : statusColor === "rust"
                    ? "bg-rust shadow-[0_0_8px_var(--color-rust)]"
                    : "bg-paper-dim shadow-[0_0_8px_var(--color-paper-dim)]"
            } ${status === "COMPUTING" ? "pulse-dot" : ""}`}
          />

          <span>REPOSITORY HEALTH</span>
        </div>

       <div className="flex items-center gap-3">
  <span className="uppercase">
    {statusLabel}
  </span>

  <button
    type="button"
    onClick={() => setIsExpanded((current) => !current)}
    aria-expanded={isExpanded}
    aria-label={
      isExpanded
        ? "Hide repository health"
        : "View repository health"
    }
    className="border border-panel-border px-2 py-1 font-mono-ui text-[9px] uppercase tracking-wide text-paper-dim transition hover:border-phosphor-dim hover:text-phosphor focus-visible:outline focus-visible:outline-2 focus-visible:outline-paper focus-visible:outline-offset-2"
  >
    {isExpanded ? "HIDE" : "VIEW"}
  </button>
</div>
      </div>

      {isExpanded && (
  <>
    {status === "COMPUTING" ? (
      <LoadingState />
    ) : status === "FAILED" ? (
      <ErrorState
        error={error ?? "Unknown health computation error."}
        onRetry={startComputation}
        computing={starting}
      />
    ) : score ? (
      <>
        <HealthContent score={score} />

        <div className="border-t border-panel-border px-4 py-3 font-mono-ui text-[9px] text-paper-dim">
        LAST COMPUTED:{" "}
        {computedAt
          ? new Date(computedAt).toISOString()
          : "UNKNOWN"}
      </div>
      </>
    ) : (
      <EmptyState
        onCompute={startComputation}
        computing={starting}
      />
    )}
  </>
)}
    </section>
  );
}