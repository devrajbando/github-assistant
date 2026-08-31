export default function RepositoriesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-12 sm:py-16">
      <div className="mb-10 flex flex-col gap-6 border-b border-panel-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 font-mono-ui text-sm text-phosphor">$ ./repositories.sh --sync</p>
          <div className="h-8 w-64 animate-pulse rounded bg-panel" />
        </div>
        <div className="h-12 w-44 animate-pulse rounded bg-panel" />
      </div>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-md border border-panel-border bg-panel"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-md border border-panel-border bg-panel"
          />
        ))}
      </div>
    </div>
  );
}