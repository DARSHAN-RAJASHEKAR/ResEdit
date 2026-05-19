"use client";

import { useState, useRef, useEffect } from "react";
import type { ProposedEdit } from "@/lib/ai";
import { Sparkles, Send, CheckCircle2, XCircle, Bot, User, CornerDownRight, Check, X, Loader2, Minus } from "lucide-react";

function stripXml(text: string): string {
  if (!text.includes("<")) return text;
  const tMatches = [...text.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)(?:<\/w:t>)/g)];
  if (tMatches.length > 0) return tMatches.map((m) => m[1]).join("").trim();
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[\s\S]*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
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
  onToggleMobile?: () => void;
}

export default function ChatPanel({ sessionId, onPreviewUpdate, onToggleMobile }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: 'Your resume is loaded! Tell me what you\'d like to improve — e.g. "Make my summary more impactful" or "Strengthen the bullet points in my latest job".',
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function updateEditStates(msgIndex: number, updates: Record<string, EditStatus>) {
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

      const appliedCount = data.results.filter((r: { applied: boolean }) => r.applied).length;
      const skippedCount = data.results.length - appliedCount;

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: appliedCount > 0
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
        setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
      } else if (!data.edits || data.edits.length === 0) {
        setMessages((prev) => [...prev, { role: "ai", text: "No changes are needed for that request." }]);
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
        { role: "ai", text: `Error: ${e instanceof Error ? e.message : "Something went wrong"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 relative shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">ResEdit AI</h2>
            <p className="text-xs text-slate-500">Your personal career coach</p>
          </div>
        </div>
        {/* Minimize button — mobile only */}
        <button
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          onClick={onToggleMobile}
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {messages.map((msg, i) => {
          const edits = msg.edits ?? [];
          const states = msg.editStates ?? {};
          const pendingEdits = edits.filter((e) => (states[e.id] ?? "pending") === "pending");
          const allResolved = edits.length > 0 && pendingEdits.length === 0;
          const isAI = msg.role === "ai";

          return (
            <div key={i} className={`flex gap-4 ${isAI ? "flex-row" : "flex-row-reverse"}`}>
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAI ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-900'}`}>
                  {isAI ? <Bot className="w-4 h-4 text-indigo-600" /> : <User className="w-4 h-4 text-white" />}
                </div>
              </div>

              {/* Message Bubble */}
              <div className={`flex flex-col ${isAI ? "items-start" : "items-end"} max-w-[85%]`}>
                {msg.text && (
                  <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${isAI ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm' : 'bg-slate-900 text-white rounded-tr-sm'}`}>
                    {isAI ? renderBold(msg.text) : msg.text}
                  </div>
                )}

                {/* Edits UI */}
                {edits.length > 0 && (
                  <div className="mt-3 w-full space-y-4">
                    {edits.map((edit) => {
                      const status = states[edit.id] ?? "pending";
                      const isAccepted = status === "accepted";
                      const isRejected = status === "rejected";
                      const isPending = status === "pending";

                      return (
                        <div
                          key={edit.id}
                          className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isRejected ? "opacity-50 grayscale" : "shadow-sm"
                            } ${isAccepted ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-white"
                            }`}
                        >
                          <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isAccepted ? 'border-green-200/50 bg-green-100/50' : 'border-slate-100 bg-slate-50'}`}>
                            <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
                              {edit.section}
                            </span>
                            {isAccepted && <span className="flex items-center gap-1 text-[11px] text-green-600 font-bold uppercase"><CheckCircle2 className="w-3.5 h-3.5" /> Applied</span>}
                            {isRejected && <span className="flex items-center gap-1 text-[11px] text-slate-400 font-bold uppercase"><XCircle className="w-3.5 h-3.5" /> Discarded</span>}
                          </div>

                          <div className="p-4 space-y-3">
                            {edit.operation === "insert_after" ? (
                              <>
                                <div className="relative pl-4 border-l-2 border-slate-200">
                                  <p className="text-xs text-slate-400 font-medium mb-1">Insert after</p>
                                  <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded-md italic">
                                    {renderBold(stripXml(edit.original))}
                                  </p>
                                </div>
                                <div className="relative pl-4 border-l-2 border-blue-400">
                                  <span className="absolute -left-2 -top-1 w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">+</span>
                                  <p className="text-xs text-blue-600 font-medium mb-1">New line</p>
                                  <p className="text-sm text-slate-900 font-medium bg-blue-50/50 p-2 rounded-md">
                                    {renderBold(stripXml(edit.replacement))}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="relative pl-4 border-l-2 border-red-200">
                                  <span className="absolute -left-2 -top-1 w-4 h-4 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[10px]"><X className="w-2.5 h-2.5" /></span>
                                  <p className="text-sm text-slate-600 bg-red-50/50 p-2 rounded-md">
                                    {renderBold(stripXml(edit.original))}
                                  </p>
                                </div>
                                <div className="relative pl-4 border-l-2 border-green-400">
                                  <span className="absolute -left-2 -top-1 w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Check className="w-3 h-3" /></span>
                                  <p className="text-sm text-slate-900 font-medium bg-green-50/50 p-2 rounded-md">
                                    {renderBold(stripXml(edit.replacement))}
                                  </p>
                                </div>
                              </>
                            )}
                            <div className="flex items-start gap-2 pt-2 text-slate-500">
                              <CornerDownRight className="w-4 h-4 shrink-0 text-indigo-400" />
                              <p className="text-xs italic leading-tight">{edit.reason}</p>
                            </div>

                            {isPending && (
                              <div className="flex gap-2 pt-3 mt-3 border-t border-slate-100">
                                <button
                                  onClick={() => acceptOne(edit, i)}
                                  disabled={loading}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
                                >
                                  <Check className="w-3.5 h-3.5" /> Accept
                                </button>
                                <button
                                  onClick={() => rejectOne(edit.id, i)}
                                  disabled={loading}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition-all active:scale-95"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {!allResolved && pendingEdits.length > 0 && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => acceptAllPending(msg, i)}
                          disabled={loading}
                          className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95"
                        >
                          Accept All {pendingEdits.length}
                        </button>
                        <button
                          onClick={() => rejectAllPending(msg, i)}
                          disabled={loading}
                          className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
                        >
                          Reject All
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-sm text-slate-500">Analyzing resume...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-100">
        <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCommand();
              }
            }}
            placeholder="E.g. Make my summary more impactful..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 overflow-y-auto"
            style={{ minHeight: "40px", maxHeight: "192px" }}
          />
          <button
            onClick={sendCommand}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors flex-shrink-0 mb-0.5"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
        <p className="text-[10px] font-medium text-slate-400 text-center mt-3 uppercase tracking-wider">
          AI can make mistakes. Review edits carefully.
        </p>
      </div>
    </div>
  );
}
