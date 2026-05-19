"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Sparkles, ArrowRight } from "lucide-react";

interface Props {
  onUploaded: (sessionId: string, htmlPreview: string) => void;
}

export default function FileUpload({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data.sessionId, data.htmlPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-50 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-5 flex items-center justify-center gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            ResEdit AI
          </h2>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-blue-100/50 border border-blue-200 text-blue-700 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Resume Editor</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-4">
            Elevate your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Resume</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Upload your DOCX file and chat with our advanced AI to instantly improve wording, fix formatting, and land your dream job.
          </p>
        </div>

        {/* Upload Box */}
        <div
          className={`w-full group relative transition-all duration-300 ease-out rounded-3xl p-10 text-center cursor-pointer overflow-hidden backdrop-blur-sm
            ${dragging
              ? "border-2 border-blue-500 bg-blue-50/80 shadow-[0_0_40px_rgba(59,130,246,0.15)] scale-[1.02]"
              : "border-2 border-dashed border-slate-300 bg-white/60 hover:border-blue-400 hover:bg-white hover:shadow-xl hover:-translate-y-1"
            }
          `}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
                <FileText className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
              </div>
              <p className="text-lg font-semibold text-slate-900">Processing Document...</p>
              <p className="text-slate-500 mt-1">Extracting text and formatting</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 mb-6 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="w-10 h-10 text-blue-600" />
              </div>
              <p className="text-xl font-semibold text-slate-900 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-slate-500 mb-6">DOCX files only</p>

              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-medium group-hover:bg-blue-600 transition-colors">
                Select Document
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 px-4 py-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Footer minimal */}
      <div className="absolute bottom-6 text-slate-400 text-sm">
        Secure and private. Files are not permanently stored.
      </div>
    </div>
  );
}
