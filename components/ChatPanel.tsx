"use client";

import { useState, useRef, useEffect } from "react";
import type { ProposedEdit } from "@/lib/ai";

function stripXml(text: string): string {
  if (!text.includes("<")) return text;
  const tMatches = [...text.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)(?:<\/w:t>)/g)];
  if (tMatches.length > 0) return tMatches.map((m) => m[1]).join("").trim();
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Render **bold** markers as <strong> elements
function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[\s\S]*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

type EditStatus = "pending" | "accepted" | "rejected";

interface Message {
  role: "user" | "ai";
  text?: string;
  edits?: ProposedEdit[];
  editStates?: Record<string, EditStatus>;
}

interface Props {
  sessionId: string;
  onPreviewUpdate: (html: string) => void;
}

export default function ChatPanel({ sessionId, onPreviewUpdate }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: 'Your resume is loaded! Tell me what you\'d like to improve — e.g. "Make my summary more impactful" or "Strengthen the bullet points in my latest job".',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function updateEditStates(
    msgIndex: number,
    updates: Record<string, EditStatus>
  ) {
    setMessages((prev) =>
      prev.map((msg, i) =>
        i === msgIndex
          ? { ...msg, editStates: { ...msg.editStates, ...updates } }
          : msg
      )
    );
  }

  async function applyEdits(edits: ProposedEdit[], msgIndex: number) {
    setLoading(true);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, edits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply edits");

      onPreviewUpdate(data.htmlPreview);

      const acceptedStates: Record<string, EditStatus> = {};
      edits.forEach((e) => (acceptedStates[e.id] = "accepted"));
      updateEditStates(msgIndex, acceptedStates);

      const appliedCount = data.results.filter(
        (r: { applied: boolean }) => r.applied
      ).length;
      const skippedCount = data.results.length - appliedCount;

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text:
            appliedCount > 0
              ? `Applied ${appliedCount} change${appliedCount > 1 ? "s" : ""}${skippedCount > 0 ? ` (${skippedCount} could not be matched)` : ""}. Preview updated.`
              : "Could not match the proposed text. Try rephrasing your command.",
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Error: ${e instanceof Error ? e.message : "Failed to apply edits"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function acceptOne(edit: ProposedEdit, msgIndex: number) {
    await applyEdits([edit], msgIndex);
  }

  async function acceptAllPending(msg: Message, msgIndex: number) {
    const pending = (msg.edits ?? []).filter(
      (e) => (msg.editStates?.[e.id] ?? "pending") === "pending"
    );
    if (pending.length) await applyEdits(pending, msgIndex);
  }

  function rejectOne(editId: string, msgIndex: number) {
    updateEditStates(msgIndex, { [editId]: "rejected" });
  }

  function rejectAllPending(msg: Message, msgIndex: number) {
    const rejectedStates: Record<string, EditStatus> = {};
    (msg.edits ?? []).forEach((e) => {
      if ((msg.editStates?.[e.id] ?? "pending") === "pending") {
        rejectedStates[e.id] = "rejected";
      }
    });
    updateEditStates(msgIndex, rejectedStates);
    setMessages((prev) => [
      ...prev,
      { role: "ai", text: "Changes discarded. What else would you like to change?" },
    ]);
  }

  async function sendCommand() {
    const command = input.trim();
    if (!command || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: command }]);
    setLoading(true);

    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get suggestions");

      if (data.type === "answer") {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: data.text },
        ]);
      } else if (!data.edits || data.edits.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "No changes are needed for that request." },
        ]);
      } else {
        const initialStates: Record<string, EditStatus> = {};
        data.edits.forEach((e: ProposedEdit) => (initialStates[e.id] = "pending"));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `I found ${data.edits.length} change${data.edits.length > 1 ? "s" : ""} to make. Review them below:`,
            edits: data.edits,
            editStates: initialStates,
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Error: ${e instanceof Error ? e.message : "Something went wrong"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold text-gray-700">AI Editor</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const edits = msg.edits ?? [];
          const states = msg.editStates ?? {};
          const pendingEdits = edits.filter(
            (e) => (states[e.id] ?? "pending") === "pending"
          );
          const allResolved = edits.length > 0 && pendingEdits.length === 0;

          return (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2"
                    : "w-full"
                }`}
              >
                {msg.text && (
                  <p className={`text-sm ${msg.role === "ai" ? "text-gray-700" : ""}`}>
                    {msg.role === "ai" ? renderBold(msg.text) : msg.text}
                  </p>
                )}

                {edits.length > 0 && (
                  <div className="mt-2 space-y-3">
                    {edits.map((edit) => {
                      const status = states[edit.id] ?? "pending";
                      return (
                        <div
                          key={edit.id}
                          className={`border rounded-xl overflow-hidden transition-opacity ${
                            status === "rejected"
                              ? "opacity-40"
                              : "opacity-100"
                          } ${
                            status === "accepted"
                              ? "border-green-300 bg-green-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
                          <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {edit.section}
                            </span>
                            {status === "accepted" && (
                              <span className="text-xs text-green-600 font-medium">✓ Accepted</span>
                            )}
                            {status === "rejected" && (
                              <span className="text-xs text-gray-400 font-medium">✗ Rejected</span>
                            )}
                          </div>

                          <div className="p-3 space-y-2">
                            <div>
                              <p className="text-xs text-red-500 font-medium mb-0.5">Remove</p>
                              <p className="text-xs text-gray-700 bg-red-50 rounded p-2 line-through">
                                {renderBold(stripXml(edit.original))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-green-600 font-medium mb-0.5">Replace with</p>
                              <p className="text-xs text-gray-700 bg-green-50 rounded p-2">
                                {renderBold(stripXml(edit.replacement))}
                              </p>
                            </div>
                            <p className="text-xs text-gray-500 italic">{edit.reason}</p>

                            {status === "pending" && (
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => acceptOne(edit, i)}
                                  disabled={loading}
                                  className="flex-1 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => rejectOne(edit.id, i)}
                                  disabled={loading}
                                  className="flex-1 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Bottom bulk actions — only shown while changes are pending */}
                    {!allResolved && pendingEdits.length > 0 && (
                      <div className="flex gap-2 pt-1 border-t border-gray-100 mt-1">
                        <button
                          onClick={() => acceptAllPending(msg, i)}
                          disabled={loading}
                          className="flex-1 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          Accept All{pendingEdits.length < edits.length ? ` Remaining (${pendingEdits.length})` : " Changes"}
                        </button>
                        <button
                          onClick={() => rejectAllPending(msg, i)}
                          disabled={loading}
                          className="flex-1 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
                        >
                          Reject All
                        </button>
                      </div>
                    )}

                    {allResolved && (
                      <p className="text-xs text-gray-400 italic text-center pt-1">
                        All changes resolved
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-1 px-3 py-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCommand();
              }
            }}
            placeholder="e.g. Make my summary more impactful..."
            rows={2}
            disabled={loading}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={sendCommand}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors self-end"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
