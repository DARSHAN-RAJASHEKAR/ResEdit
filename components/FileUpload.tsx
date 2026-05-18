"use client";

import { useRef, useState } from "react";

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
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Resume Editor</h1>
          <p className="mt-2 text-gray-500">
            Upload your resume and let AI help you improve it
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className="text-5xl mb-4">📄</div>
          {loading ? (
            <p className="text-blue-600 font-medium">Uploading & parsing...</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium">
                Drop your .docx file here
              </p>
              <p className="text-gray-400 text-sm mt-1">
                or click to browse
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-red-600 text-sm text-center">{error}</p>
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
    </div>
  );
}
