"use client";

import { Download, FileText, Info, Home } from "lucide-react";
import { useState } from "react";

interface Props {
  html: string;
  sessionId: string;
  onHome: () => void;
  isMobileExpanded?: boolean;
  onMinimizeChat?: () => void;
}

export default function DocumentPreview({ html, sessionId, onHome, isMobileExpanded = false, onMinimizeChat }: Props) {
  const [showBanner, setShowBanner] = useState(true);
  const [fileName, setFileName] = useState("resume-edited");
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onHome}
            className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Upload new resume"
          >
            <Home className="w-4 h-4" />
            <span className="hidden md:inline text-sm font-medium">Home</span>
          </button>
          <div className="w-px h-5 bg-slate-200"></div>
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            <span className="text-sm md:text-base">Resume Preview</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { onMinimizeChat?.(); setShowDownloadModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 hover:shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Banner — hidden on mobile when chat is open */}
      {showBanner && !isMobileExpanded && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-start gap-3 relative z-10">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-blue-800 font-medium">
              Simplified Web Preview
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              This preview only shows text content. Don't worry—your original formatting, margins, and fonts are perfectly preserved when you download the final file.
            </p>
          </div>
          <button 
            onClick={() => setShowBanner(false)}
            className="text-blue-400 hover:text-blue-600 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto py-8 px-4 scroll-smooth bg-gray-100">
        <div className="w-[794px] max-w-full mx-auto bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-1 ring-slate-900/5 min-h-[1123px] p-[96px]">
          <style>{`
            .resume-content {
              color: #1e293b;
              font-family: Calibri, 'Gill Sans', 'Trebuchet MS', sans-serif;
            }
            .resume-content h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; letter-spacing: -0.025em; }
            .resume-content h2 { font-size: 1.15rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.25rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
            .resume-content h3 { font-size: 1rem; font-weight: 600; margin-top: 0.75rem; color: #334155; }
            .resume-content p { margin-bottom: 0.35rem; font-size: 0.95rem; line-height: 1.6; color: #475569; }
            .resume-content ul { list-style-type: none; padding-left: 0; margin-bottom: 0.5rem; }
            .resume-content ul li { position: relative; padding-left: 1.25rem; font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.25rem; color: #475569; }
            .resume-content ul li::before { content: "•"; position: absolute; left: 0; color: #94a3b8; font-weight: bold; font-size: 1.2em; line-height: 1; top: 0.1em; }
            .resume-content strong { font-weight: 600; color: #0f172a; }
            .resume-content em { font-style: italic; color: #64748b; }
            .resume-content table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; }
            .resume-content td, .resume-content th { padding: 4px 6px; font-size: 0.95rem; text-align: left; }
          `}</style>
          <div
            className="resume-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
      {/* Download Modal */}
      {showDownloadModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Save Resume</h3>
              <p className="text-sm text-slate-500 mt-1">Enter a name for your downloaded file.</p>
            </div>
            <div className="p-6">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all shadow-inner">
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="resume-edited"
                  autoFocus
                  className="w-full bg-transparent py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <span className="text-sm text-slate-400 font-medium select-none whitespace-nowrap ml-2">.docx</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <a
                href={`/api/download/${sessionId}`}
                download={`${fileName || "resume-edited"}.docx`}
                onClick={() => setShowDownloadModal(false)}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm transition-all active:scale-95"
              >
                Save File
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
