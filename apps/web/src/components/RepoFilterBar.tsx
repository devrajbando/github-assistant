/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SortOption = "updated" | "name" | "open_prs" | "open_issues";
export type VisibilityFilter = "all" | "public" | "private";
export type IndexFilter = "all" | "indexed" | "not_indexed";

type RepoFilterBarProps = {
  query: string;
  sort: SortOption;
  visibility: VisibilityFilter;
  indexed: IndexFilter;
};

const SORT_LABELS: Record<SortOption, string> = {
  updated: "Recently updated",
  name: "Name (A–Z)",
  open_prs: "Most open PRs",
  open_issues: "Most open issues",
};

const VISIBILITY_LABELS: Record<VisibilityFilter, string> = {
  all: "All visibility",
  public: "Public only",
  private: "Private only",
};

const INDEX_LABELS: Record<IndexFilter, string> = {
  all: "Any index status",
  indexed: "Indexed only",
  not_indexed: "Not indexed",
};

const SEARCH_DEBOUNCE_MS = 350;

const selectClass =
  "rounded border border-panel-border bg-console px-2.5 py-1.5 font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim outline-none transition-colors focus:border-phosphor-dim focus:text-paper";

export default function RepoFilterBar({ query, sort, visibility, indexed }: RepoFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync with the URL on back/forward navigation or a
  // "Clear filters" link elsewhere on the page.
  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      const isDefault =
        !value ||
        value === "all" ||
        (key === "sort" && value === "updated") ||
        (key === "q" && value.trim() === "");
      if (isDefault) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value.trim() }), SEARCH_DEBOUNCE_MS);
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchValue("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }

  const hasActiveFilters = Boolean(query) || sort !== "updated" || visibility !== "all" || indexed !== "all";

  return (
    <div className="flex flex-col gap-3 border-b border-panel-border pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <label className="flex min-w-0 items-center gap-2 rounded border border-panel-border bg-console px-3 py-2 sm:w-72">
        <span className="font-mono-ui text-xs text-phosphor" aria-hidden="true">
          $ grep
        </span>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="name, owner…"
          aria-label="Search repositories"
          className="min-w-0 flex-1 bg-transparent font-mono-ui text-xs text-paper placeholder:text-paper-dim focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          aria-label="Sort repositories"
          className={selectClass}
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          value={visibility}
          onChange={(e) => updateParams({ visibility: e.target.value })}
          aria-label="Filter by visibility"
          className={selectClass}
        >
          {(Object.keys(VISIBILITY_LABELS) as VisibilityFilter[]).map((value) => (
            <option key={value} value={value}>
              {VISIBILITY_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          value={indexed}
          onChange={(e) => updateParams({ indexed: e.target.value })}
          aria-label="Filter by index status"
          className={selectClass}
        >
          {(Object.keys(INDEX_LABELS) as IndexFilter[]).map((value) => (
            <option key={value} value={value}>
              {INDEX_LABELS[value]}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim transition-colors hover:text-phosphor"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}