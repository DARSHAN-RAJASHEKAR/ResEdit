import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/store";
import { proposeEdits } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { sessionId, command } = await req.json();

  if (!sessionId || !command) {
    return NextResponse.json(
      { error: "sessionId and command are required" },
      { status: 400 }
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const documentText = session.paragraphs.join("\n");
  const edits = await proposeEdits(documentText, command);

  return NextResponse.json({ edits });
}
