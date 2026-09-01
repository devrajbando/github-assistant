// components/SourceChunk.tsx
"use client";

type Props = {
  filePath: string;
  content: string;
};

export default function SourceChunk({ filePath, content }: Props) {
  return (
    <div className="border border-panel-border p-3">
      <p className="mb-2 font-mono-ui text-[10.5px] uppercase tracking-wide text-phosphor-dim">
        {filePath}
      </p>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono-ui text-[10.5px] leading-5 text-paper-dim">
        {content}
      </pre>
    </div>
  );
}