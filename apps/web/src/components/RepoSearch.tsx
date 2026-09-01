"use client";

import { useState, type FormEvent } from "react";
import type { IndexStatus } from "@/lib/index-repository";
import SourceChunk from "./SourceChunk";

type SearchResult = {
  filePath: string;
  content: string;
  distance: number;
};

type Props = {
  repositoryId: string;
  indexStatus: IndexStatus;
};

export default function RepoSearch({ repositoryId, indexStatus }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/repositories/${repositoryId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
      // A fresh search should always land visible, even if the user
      // hid the previous set of results before running this one.
      setShowResults(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  if (indexStatus !== "INDEXED") {
    return (
      <section className="rounded-md border border-panel-border bg-panel p-4">
        <p className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim">
          CODE SEARCH
        </p>
        <p className="mt-2 font-mono-ui text-[10px] text-paper-dim">
          Index this repository first to enable natural language code search.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-panel-border bg-panel">
      <div className="border-b border-panel-border px-4 py-3">
        <p className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim">
          CODE SEARCH
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. where do we validate GitHub webhook signatures?"
            className="flex-1 border border-panel-border bg-console px-3 py-2 font-mono-ui text-[12px] text-paper placeholder:text-paper-dim focus-visible:outline-2 focus-visible:outline-phosphor-dim"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="border border-amber bg-amber px-4 py-2 font-mono-ui text-[11px] font-bold uppercase tracking-wide text-console transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "SEARCHING…" : "SEARCH"}
          </button>
        </form>

        {error && (
          <p className="mt-3 font-mono-ui text-[10.5px] text-rust">{error}</p>
        )}

        {results && (
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono-ui text-[10px] uppercase tracking-wide text-paper-dim">
                {results.length === 0
                  ? "No matching code found."
                  : `${results.length} result${results.length === 1 ? "" : "s"} found`}
              </p>

              {results.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResults((v) => !v)}
                  className="border border-panel-border bg-transparent px-3 py-1.5 font-mono-ui text-[10px] font-bold uppercase tracking-wide text-paper-dim transition hover:border-paper-dim hover:text-paper"
                >
                  {showResults ? "Hide results" : "View results"}
                </button>
              )}
            </div>

            {showResults && results.length > 0 && (
              <div className="mt-3 space-y-3">
               {results.map((r, i) => (
  <SourceChunk key={`${r.filePath}-${i}`} filePath={r.filePath} content={r.content} />
))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}