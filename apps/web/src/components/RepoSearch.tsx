"use client";

import { useState, type FormEvent } from "react";
import type { IndexStatus } from "@/lib/index-repository";

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
            className="flex-1 border border-panel-border bg-console px-3 py-2 font-mono-ui text-[12px] text-paper placeholder:text-paper-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-phosphor-dim"
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
          <div className="mt-5 space-y-3">
            {results.length === 0 ? (
              <p className="font-mono-ui text-[10px] text-paper-dim">
                No matching code found.
              </p>
            ) : (
              results.map((r, i) => (
                <div key={`${r.filePath}-${i}`} className="border border-panel-border p-3">
                  <p className="mb-2 font-mono-ui text-[10.5px] uppercase tracking-wide text-phosphor-dim">
                    {r.filePath}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono-ui text-[10.5px] leading-5 text-paper-dim">
                    {r.content}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}