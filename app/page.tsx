"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";

const FileUpload = dynamic(() => import("@/components/FileUpload"), { ssr: false });
const DocumentPreview = dynamic(() => import("@/components/DocumentPreview"), { ssr: false });
const ChatPanel = dynamic(() => import("@/components/ChatPanel"), { ssr: false });

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string>("");
  const [mobileExpanded, setMobileExpanded] = useState(true);

  function handleUploaded(id: string, html: string) {
    setSessionId(id);
    setHtmlPreview(html);
    setMobileExpanded(true);
  }

  if (!sessionId) {
    return <FileUpload onUploaded={handleUploaded} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Document Preview — always behind on mobile, flex-1 on desktop */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <DocumentPreview
          html={htmlPreview}
          sessionId={sessionId}
          onHome={() => setSessionId(null)}
          isMobileExpanded={mobileExpanded}
          onMinimizeChat={() => setMobileExpanded(false)}
        />
      </div>

      {/* Chat Panel — bottom sheet on mobile, sidebar on desktop */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 transition-[height] duration-300 ease-in-out
          md:relative md:w-[420px] md:shrink-0 md:overflow-hidden md:h-full md:transition-none
          ${mobileExpanded ? "h-[75vh]" : "h-0 overflow-hidden"}
        `}
      >
        <ChatPanel
          sessionId={sessionId}
          onPreviewUpdate={setHtmlPreview}
          onToggleMobile={() => setMobileExpanded(false)}
        />
      </div>

      {/* Floating minimized box — mobile only, shown when chat is collapsed */}
      {!mobileExpanded && (
        <div
          className="md:hidden fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xl cursor-pointer active:scale-95 transition-transform"
          onClick={() => setMobileExpanded(true)}
        >
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-sm font-medium text-slate-700">ResEdit AI</span>
        </div>
      )}
    </div>
  );
}
