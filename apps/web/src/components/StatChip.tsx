type StatChipProps = {
  label: string;
  value: number;
  accent?: "phosphor" | "amber";
};

export default function StatChip({ label, value, accent = "phosphor" }: StatChipProps) {
  const dotClass =
    accent === "amber"
      ? "bg-amber shadow-[0_0_6px_var(--color-amber)]"
      : "bg-phosphor shadow-[0_0_6px_var(--color-phosphor)]";

  return (
    <div className="rounded-md border border-panel-border bg-panel px-4 py-4">
      <div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-widest text-paper-dim">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
        {label}
      </div>
      <div className="font-display text-2xl font-bold text-paper">{value}</div>
    </div>
  );
}