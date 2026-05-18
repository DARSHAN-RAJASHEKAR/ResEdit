import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { docxToHtml, extractDocxParagraphs } from "@/lib/docx";
import { setSession } from "@/lib/store";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (
    !file.name.endsWith(".docx") &&
    file.type !==
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return NextResponse.json(
      { error: "Please upload a .docx file" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const [htmlPreview, paragraphs] = await Promise.all([
    docxToHtml(buffer),
    Promise.resolve(extractDocxParagraphs(buffer)),
  ]);

  const sessionId = randomUUID();
  setSession(sessionId, { currentBuffer: buffer, htmlPreview, paragraphs });

  return NextResponse.json({ sessionId, htmlPreview });
}
