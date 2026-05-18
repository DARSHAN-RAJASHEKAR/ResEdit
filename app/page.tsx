"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const FileUpload = dynamic(() => import("@/components/FileUpload"), { ssr: false });
const DocumentPreview = dynamic(() => import("@/components/DocumentPreview"), { ssr: false });
const ChatPanel = dynamic(() => import("@/components/ChatPanel"), { ssr: false });

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string>("");

  function handleUploaded(id: string, html: string) {
    setSessionId(id);
    setHtmlPreview(html);
  }

  if (!sessionId) {
    return <FileUpload onUploaded={handleUploaded} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 min-w-0 overflow-hidden">
        <DocumentPreview html={htmlPreview} sessionId={sessionId} />
      </div>
      <div className="w-[420px] shrink-0 overflow-hidden">
        <ChatPanel sessionId={sessionId} onPreviewUpdate={setHtmlPreview} />
      </div>
    </div>
  );
}
