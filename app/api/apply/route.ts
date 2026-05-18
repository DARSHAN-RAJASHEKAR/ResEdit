import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
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

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let currentBuffer = session.currentBuffer;
  const results: { id: string; applied: boolean }[] = [];

  for (const edit of edits) {
    const { buffer, applied } = applyEdit(
      currentBuffer,
      edit.original,
      edit.replacement
    );
    if (applied) currentBuffer = buffer;
    results.push({ id: edit.id, applied });
  }

  const [htmlPreview, paragraphs] = await Promise.all([
    docxToHtml(currentBuffer),
    Promise.resolve(extractDocxParagraphs(currentBuffer)),
  ]);

  updateSession(sessionId, { currentBuffer, htmlPreview, paragraphs });

  return NextResponse.json({ htmlPreview, results });
}
