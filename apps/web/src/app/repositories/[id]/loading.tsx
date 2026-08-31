export default function RepositoryDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:px-12 sm:py-16">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-panel" />

      <div className="mb-8 flex flex-col gap-6 border-b border-panel-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-3 font-mono-ui text-sm text-phosphor">$ cd ./repository</p>
          <div className="h-7 w-2/3 animate-pulse rounded bg-panel" />
        </div>
        <div className="h-12 w-48 animate-pulse rounded bg-panel" />
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-md border border-panel-border bg-panel"
          />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-md border border-panel-border bg-panel"
          />
        ))}
      </div>
    </div>
  );
}