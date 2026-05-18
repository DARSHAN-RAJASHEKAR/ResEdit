"use client";

interface Props {
  html: string;
  sessionId: string;
}

export default function DocumentPreview({ html, sessionId }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <span className="text-sm font-medium text-gray-600">Preview</span>
        <a
          href={`/api/download/${sessionId}`}
          download="resume-edited.docx"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download DOCX
        </a>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
        <div className="max-w-[800px] mx-auto bg-white shadow-lg rounded-sm min-h-[1056px] p-[72px]">
          <style>{`
            .resume-content h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
            .resume-content h2 { font-size: 1.1rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.25rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.125rem; }
            .resume-content h3 { font-size: 1rem; font-weight: 600; margin-top: 0.5rem; }
            .resume-content p { margin-bottom: 0.25rem; font-size: 0.9rem; line-height: 1.5; }
            .resume-content ul { list-style-type: disc; padding-left: 1.25rem; margin-bottom: 0.25rem; }
            .resume-content li { font-size: 0.9rem; line-height: 1.5; margin-bottom: 0.1rem; }
            .resume-content strong { font-weight: 600; }
            .resume-content em { font-style: italic; }
            .resume-content table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
            .resume-content td, .resume-content th { padding: 2px 4px; font-size: 0.9rem; }
          `}</style>
          <div
            className="resume-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
