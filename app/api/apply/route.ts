import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession, bufferToB64, b64ToBuffer } from "@/lib/store";
import { applyEdit, docxToHtml, extractDocxParagraphs } from "@/lib/docx";
import type { ProposedEdit } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { sessionId, edits } = (await req.json()) as {
    sessionId: string;
    edits: ProposedEdit[];
  };

  if (!sessionId || !edits?.length) {
    return NextResponse.json(
      { error: "sessionId and edits are required" },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let currentBuffer = b64ToBuffer(session.currentBufferB64);
  const results: { id: string; applied: boolean }[] = [];

  for (const edit of edits) {
    const { buffer, applied } = applyEdit(
      currentBuffer,
      edit.original,
      edit.replacement,
      edit.operation ?? "replace"
    );
    if (applied) currentBuffer = buffer;
    results.push({ id: edit.id, applied });
  }

  const { plain, annotated } = extractDocxParagraphs(currentBuffer);
  const htmlPreview = await docxToHtml(currentBuffer);

  const appliedEdits = edits.filter((e) =>
    results.find((r) => r.id === e.id && r.applied)
  );

  const historyEntry =
    appliedEdits.length > 0
      ? `User accepted ${appliedEdits.length} change(s): ${appliedEdits
        .map((e) => `In "${e.section}": changed "${e.original.replace(/\*\*/g, "")}" to "${e.replacement.replace(/\*\*/g, "")}"`)
        .join("; ")}`
      : "User accepted changes but none could be matched in the document.";

  await updateSession(sessionId, {
    currentBufferB64: bufferToB64(currentBuffer),
    htmlPreview,
    paragraphs: plain,
    annotatedParagraphs: annotated,
    history: [
      ...session.history,
      { role: "assistant", content: historyEntry },
    ],
  });

  return NextResponse.json({ htmlPreview, results });
}
