"use client";

import { useEffect, useRef, useState } from "react";

const LOG_LINES = [
  "SYNC-ENGINE: 42 repositories indexed",
  "AI-COPILOT: grounded in live PR + issue data",
  "CODE-REVIEW: 3 findings flagged, severity-ranked",
  "TOKEN-VAULT: AES-256-GCM, encrypted at rest",
  "AUTH: session verified, token refreshed on sign-in",
  "SYNC-ENGINE: repository cache revalidated",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function timestamp() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type LogEntry = { id: string; text: string; ts: string };

export default function ConsoleReadout() {
  const [lines, setLines] = useState<LogEntry[]>([]);
  const idxRef = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLines(LOG_LINES.map((text, i) => ({ id: String(i), text, ts: timestamp() })));
      return;
    }

    const push = () => {
      const text = LOG_LINES[idxRef.current % LOG_LINES.length];
      idxRef.current += 1;
      setLines((prev) => {
        const next = [...prev, { id: crypto.randomUUID(), text, ts: timestamp() }];
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });
    };

    push();
    const id = setInterval(push, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="font-mono-ui text-xs leading-8 text-phosphor"
      aria-hidden="true"
    >
      {lines.map((line) => (
        <div key={line.id} className="console-line">
          <span className="mr-2 text-paper-dim">{line.ts}</span>
          {"> "}
          {line.text}
        </div>
      ))}
    </div>
  );
}