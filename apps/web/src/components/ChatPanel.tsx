"use client";

import { useState, useRef, useEffect } from "react";

interface ChatPanelMessage {
  id: string;
  role: string;
  content: string;
}

export function ChatPanel({
  repositoryId,
  initialMessages,
}: {
  repositoryId: string;
  initialMessages: ChatPanelMessage[];
}) {
  const [messages, setMessages] = useState<ChatPanelMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const userMessage: ChatPanelMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantId = `local-${Date.now()}-assistant`;
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/repositories/${repositoryId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      }
    } catch (err) {
        console.error(err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong getting a response. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Ask about this repository
      </h2>

      <div className="rounded-md border border-gray-200">
        <div className="max-h-96 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">Ask a question about this repo&apos;s PRs, issues, or code.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={
                    "inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap " +
                    (m.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900")
                  }
                >
                  {m.content || (isStreaming && m.role === "assistant" ? "…" : "")}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-gray-200 px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={isStreaming}
            className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}