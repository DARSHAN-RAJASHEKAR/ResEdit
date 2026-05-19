import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
import { processCommand } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { sessionId, command } = await req.json();

  if (!sessionId || !command) {
    return NextResponse.json(
      { error: "sessionId and command are required" },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const documentText = session.annotatedParagraphs.join("\n");
  const response = await processCommand(documentText, command, session.history);

  // Summarise the AI response for history storage
  const assistantSummary =
    response.type === "answer"
      ? response.text
      : `Proposed ${response.edits.length} edit(s): ${response.edits.map((e) => e.reason).join("; ")}`;

  updateSession(sessionId, {
    history: [
      ...session.history,
      { role: "user", content: command },
      { role: "assistant", content: assistantSummary },
    ],
  });

  return NextResponse.json(response);
}
