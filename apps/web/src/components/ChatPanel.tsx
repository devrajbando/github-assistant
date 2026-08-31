/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Highlight, type Language, type PrismTheme } from "prism-react-renderer";

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  provider?: string | null;
  model?: string | null;
  status?: "error";
  requestText?: string; // only set on assistant messages sent this session — needed to retry
};

type ChatPanelProps = {
  repositoryId: string;
  initialMessages: ChatMessage[];
};

const THINKING_PHRASES = [
  "CONNECTING",
  "RETRIEVING CONTEXT",
  "SEARCHING CODEBASE",
  "SYNTHESIZING",
  "COMPOSING REPLY",
];

// Panel sizing — bigger default than before, and user-resizable within
// these bounds. Persisted to localStorage so a chosen size sticks
// across sessions.
const DEFAULT_PANEL_WIDTH = 480;
const DEFAULT_PANEL_HEIGHT = 600;
const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 420;
const MAX_PANEL_WIDTH = 860;
const MAX_PANEL_HEIGHT = 600;
const PANEL_SIZE_STORAGE_KEY = "ai-copilot-panel-size";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadStoredPanelSize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
  try {
    const raw = window.localStorage.getItem(PANEL_SIZE_STORAGE_KEY);
    if (!raw) return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
    const parsed = JSON.parse(raw);
    return {
      width: clamp(Number(parsed.width) || DEFAULT_PANEL_WIDTH, MIN_PANEL_WIDTH, MAX_PANEL_WIDTH),
      height: clamp(Number(parsed.height) || DEFAULT_PANEL_HEIGHT, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT),
    };
  } catch {
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
}

// Deliberately only the colors already defined in globals.css — no new
// hues introduced, so code blocks stay inside the same restrained
// phosphor/amber system as the rest of the UI instead of becoming a
// generic rainbow syntax theme.
const terminalCodeTheme: PrismTheme = {
  plain: { color: "#E7E3D8", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#8A8778", fontStyle: "italic" } },
    { types: ["keyword", "atrule", "tag"], style: { color: "#FFB627" } },
    { types: ["string", "char", "attr-value", "regex"], style: { color: "#3DFF8F" } },
    { types: ["function", "class-name", "attr-name"], style: { color: "#1F8F52" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "#8F6A1C" } },
    { types: ["punctuation", "operator"], style: { color: "#8A8778" } },
  ],
};

export default function ChatPanel({ repositoryId, initialMessages }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [panelSize, setPanelSize] = useState(() => loadStoredPanelSize());
  const [isResizing, setIsResizing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Dragging the corner grip grows the panel toward the top-left, since
  // it's anchored to the bottom-right of the screen.
  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height,
    };
    setIsResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    const nextWidth = clamp(start.width + (start.x - e.clientX), MIN_PANEL_WIDTH, MAX_PANEL_WIDTH);
    const nextHeight = clamp(start.height + (start.y - e.clientY), MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT);
    setPanelSize({ width: nextWidth, height: nextHeight });
  }

  function handleResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    setIsResizing(false);
    try {
      window.localStorage.setItem(PANEL_SIZE_STORAGE_KEY, JSON.stringify(panelSize));
    } catch {
      // Best-effort persistence only — a full storage quota or disabled
      // localStorage shouldn't break resizing itself.
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleResizeDoubleClick() {
    setPanelSize({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT });
    try {
      window.localStorage.removeItem(PANEL_SIZE_STORAGE_KEY);
    } catch {
      // Ignore — resetting in-memory size is what matters most.
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    } else {
      setHasNewBelow(true);
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewBelow(false);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setIsAtBottom(true);
    setHasNewBelow(false);
  }

  async function runAssistantRequest(assistantId: string, text: string) {
    try {
      const res = await fetch(`/api/repositories/${repositoryId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) throw new Error(`request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let receivedAny = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) receivedAny = true;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      }

      if (!receivedAny) throw new Error("empty response");
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, status: "error" } : m))
      );
    }
  }

  async function sendNewMessage(text: string) {
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "", requestText: text },
    ]);
    setIsAtBottom(true);
    setSending(true);
    await runAssistantRequest(assistantId, text);
    setSending(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendNewMessage(text);
  }

  async function handleRetry(message: ChatMessage) {
    if (!message.requestText || sending) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, content: "", status: undefined } : m))
    );
    setIsAtBottom(true);
    setSending(true);
    await runAssistantRequest(message.id, message.requestText);
    setSending(false);
  }

  return (
    <>
     <div className="group fixed bottom-6 right-6 z-70 flex flex-col items-center">
  

  <button
    type="button"
    onClick={() => setIsOpen((v) => !v)}
    aria-expanded={isOpen}
    aria-label={isOpen ? "Close AI Copilot" : "Open AI Copilot"}
    className="
      flex h-14 w-14 items-center justify-center
      rounded-full border border-phosphor-dim
      bg-panel font-mono-ui text-phosphor
      shadow-[0_0_24px_rgba(61,255,143,0.15)]
      transition-all duration-150
      hover:border-phosphor
      hover:shadow-[0_0_32px_rgba(61,255,143,0.35)]
    "
  >
    <span className="text-sm">{isOpen ? "×" : ">_"}</span>
  </button>

  {/* Label */}
  <span
    className="
      mt-1.5 font-mono-ui text-[9px]
      uppercase tracking-wider text-paper-dim
    "
  >
    ask copilot
  </span>
</div>

      <div
        role="dialog"
        aria-label="AI Copilot chat"
        aria-hidden={!isOpen}
        style={
          {
            "--panel-w": `${panelSize.width}px`,
            "--panel-h": `${panelSize.height}px`,
          } as React.CSSProperties
        }
        className={`fixed inset-4 z-70 flex flex-col rounded-md border border-panel-border bg-panel shadow-[0_0_60px_rgba(0,0,0,0.5)] sm:inset-auto sm:bottom-24 sm:right-6 sm:h-(--panel-h) sm:w-(--panel-w) ${
          isResizing ? "transition-none select-none" : "transition-all duration-200"
        } ${isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
      >
        <div
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onDoubleClick={handleResizeDoubleClick}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize AI Copilot panel (double-click to reset)"
          title="Drag to resize · double-click to reset"
          className="group absolute left-0 top-0 z-10 hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none items-center justify-center sm:flex"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="text-phosphor-dim/60 transition-colors group-hover:text-phosphor">
            <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
            <circle cx="5" cy="1.5" r="1" fill="currentColor" />
            <circle cx="8.5" cy="1.5" r="1" fill="currentColor" />
            <circle cx="1.5" cy="5" r="1" fill="currentColor" />
            <circle cx="5" cy="5" r="1" fill="currentColor" />
            <circle cx="1.5" cy="8.5" r="1" fill="currentColor" />
          </svg>
        </div>

        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 font-mono-ui text-[11px] tracking-wide text-paper-dim">
          <span className="flex items-center gap-2">
            <span
              className="pulse-dot h-1.5 w-1.5 rounded-full bg-phosphor shadow-[0_0_8px_var(--color-phosphor)]"
              aria-hidden="true"
            />
            AI COPILOT
          </span>
          <div className="flex items-center gap-3">
            <span>{sending ? "WORKING" : "READY"}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-paper-dim transition-colors hover:text-phosphor"
            >
              x
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full space-y-4 overflow-y-auto px-4 py-5 [scrollbar-color:var(--color-phosphor-dim)_transparent] scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-phosphor-dim/50 [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-phosphor-dim/80"
          >
            {messages.length === 0 && (
              <p className="font-mono-ui text-xs text-paper-dim">
                Ask a question about this repository&rsquo;s recent pull requests, issues, or code.
              </p>
            )}
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} onRetry={handleRetry} sending={sending} />
            ))}
          </div>

          {hasNewBelow && (
            <button
              type="button"
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-phosphor-dim bg-panel px-3 py-1 font-mono-ui text-[10px] uppercase tracking-wide text-phosphor shadow-[0_0_16px_rgba(61,255,143,0.2)] transition-colors hover:bg-console"
            >
              ↓ new reply
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 border-t border-panel-border px-4 py-3"
        >
          <span className="font-mono-ui text-sm text-phosphor" aria-hidden="true">
            $
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this repository…"
            disabled={sending}
            className="flex-1 bg-transparent font-mono-ui text-sm text-paper placeholder:text-paper-dim focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded border border-panel-border px-3 py-1.5 font-mono-ui text-[11px] uppercase tracking-wide text-paper-dim transition-colors hover:border-phosphor-dim hover:text-phosphor disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 font-mono-ui text-xs text-phosphor-dim">
      <span className="inline-flex gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phosphor-dim" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phosphor-dim [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-phosphor-dim [animation-delay:300ms]" />
      </span>
      {THINKING_PHRASES[phraseIndex]}…
    </span>
  );
}

function ChatBubble({
  message,
  onRetry,
  sending,
}: {
  message: ChatMessage;
  onRetry: (m: ChatMessage) => void;
  sending: boolean;
}) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isEmpty = !message.content && !isError;

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div className="mb-1 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-widest text-paper-dim">
        {isUser ? "you" : "copilot"}
        {message.model && <span className="normal-case text-paper-dim/70">· {message.model}</span>}
      </div>
      <div
        className={`max-w-[88%] rounded-md border px-3.5 py-2.5 text-sm leading-relaxed ${
          isError
            ? "border-rust/50 bg-console text-paper"
            : isUser
              ? "whitespace-pre-wrap border-panel-border bg-console text-paper"
              : "border-phosphor-dim/40 bg-console text-paper"
        }`}
      >
        {isEmpty ? (
          <ThinkingIndicator />
        ) : isUser ? (
          message.content
        ) : (
          <MarkdownMessage content={message.content} />
        )}

        {isError && (
          <div className="mt-2 flex items-center gap-3 border-t border-rust/30 pt-2 font-mono-ui text-xs text-rust">
            <span>RESPONSE FAILED</span>
            <button
              type="button"
              onClick={() => onRetry(message)}
              disabled={sending}
              className="rounded border border-rust/50 px-2 py-1 uppercase tracking-wide text-rust transition-colors hover:bg-rust/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => (
          <h3
            className="mb-1.5 mt-3 font-display text-sm uppercase tracking-wide text-paper first:mt-0"
            {...props}
          />
        ),

        h2: (props) => (
          <h3
            className="mb-1.5 mt-3 font-display text-sm uppercase tracking-wide text-paper first:mt-0"
            {...props}
          />
        ),

        h3: (props) => (
          <h4
            className="mb-1 mt-2.5 font-display text-xs uppercase tracking-wide text-paper-dim first:mt-0"
            {...props}
          />
        ),

        p: (props) => (
          <p className="mb-2 last:mb-0" {...props} />
        ),

        strong: (props) => (
          <strong className="font-semibold text-amber" {...props} />
        ),

        em: (props) => (
          <em className="italic text-paper" {...props} />
        ),

        a: (props) => (
          <a
            className="text-phosphor underline decoration-phosphor-dim underline-offset-2 hover:text-phosphor"
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),

        ul: (props) => (
          <ul
            className="mb-2 ml-4 list-disc space-y-1 marker:text-phosphor-dim last:mb-0"
            {...props}
          />
        ),

        ol: (props) => (
          <ol
            className="mb-2 ml-4 list-decimal space-y-1 marker:text-phosphor-dim last:mb-0"
            {...props}
          />
        ),

        li: (props) => (
          <li className="pl-1" {...props} />
        ),

        blockquote: (props) => (
          <blockquote
            className="my-2 border-l-2 border-phosphor-dim/50 pl-3 italic text-paper-dim"
            {...props}
          />
        ),

        hr: () => <hr className="my-3 border-panel-border" />,

        table: (props) => (
          <div className="my-2 overflow-x-auto">
            <table
              className="w-full border-collapse font-mono-ui text-xs"
              {...props}
            />
          </div>
        ),

        th: (props) => (
          <th
            className="border border-panel-border bg-panel px-2 py-1 text-left text-paper-dim"
            {...props}
          />
        ),

        td: (props) => (
          <td
            className="border border-panel-border px-2 py-1"
            {...props}
          />
        ),

        code(props) {
          const { className, children } = props as {
            className?: string;
            children?: React.ReactNode;
          };

          const match = /language-(\w+)/.exec(className || "");

          if (match) {
            return (
              <CodeBlock
                language={match[1]}
                code={String(children).replace(/\n$/, "")}
              />
            );
          }

          return (
            <code className="rounded bg-panel px-1.5 py-0.5 font-mono-ui text-[0.85em] text-amber">
              {children}
            </code>
          );
        },

        pre({ children }) {
          // Fenced blocks arrive as <pre><code>...</code></pre>.
          // CodeBlock already renders its own <pre>, so unwrap this one.
          return <>{children}</>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — not
      // worth surfacing an error for a non-critical convenience action.
    }
  }

  return (
    <div className="my-2.5 overflow-hidden rounded border border-panel-border bg-console">
      <div className="flex items-center justify-between border-b border-panel-border bg-panel px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-widest text-paper-dim">
        <span>{language || "code"}</span>
        <button type="button" onClick={handleCopy} className="text-paper-dim transition-colors hover:text-phosphor">
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <Highlight theme={terminalCodeTheme} code={code} language={language as Language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} overflow-x-auto px-3.5 py-3 font-mono-ui text-[13px] leading-relaxed`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}