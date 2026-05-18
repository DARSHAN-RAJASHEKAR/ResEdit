import PizZip from "pizzip";
import mammoth from "mammoth";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractParagraphText(paragraphXml: string): string {
  let text = "";
  const tRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = tRegex.exec(paragraphXml)) !== null) {
    text += match[1];
  }
  // Decode XML entities so the AI sees clean plain text
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Strip XML tags from a string — used to sanitize AI-returned `original` fields
// in case the model hallucinated or included markup.
function stripXml(text: string): string {
  if (!text.includes("<")) return text;
  // Try to pull text from <w:t> tags first (most accurate)
  const tMatches = [...text.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)(?:<\/w:t>)/g)];
  if (tMatches.length > 0) {
    return tMatches.map((m) => m[1]).join("").trim();
  }
  // Fall back to stripping all tags
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function rebuildParagraph(
  paragraphXml: string,
  newText: string
): string {
  const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const rPrMatch = paragraphXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
  const rPr = rPrMatch ? rPrMatch[0] : "";
  const openTagMatch = paragraphXml.match(/^<w:p(?:\s[^>]*)?>/);
  const openTag = openTagMatch ? openTagMatch[0] : "<w:p>";
  const spaceAttr =
    newText.startsWith(" ") || newText.endsWith(" ")
      ? ' xml:space="preserve"'
      : "";
  return `${openTag}${pPr}<w:r>${rPr}<w:t${spaceAttr}>${escapeXml(newText)}</w:t></w:r></w:p>`;
}

export function extractDocxParagraphs(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const xml = zip.files["word/document.xml"].asText();
  const paragraphs: string[] = [];
  const pRegex = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const text = extractParagraphText(match[0]);
    if (text.trim()) paragraphs.push(text);
  }
  return paragraphs;
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

export function applyEdit(
  buffer: Buffer,
  original: string,
  replacement: string
): { buffer: Buffer; applied: boolean } {
  const zip = new PizZip(buffer);
  const xml = zip.files["word/document.xml"].asText();
  let applied = false;

  const cleanedOriginal = stripXml(original);
  const normOriginal = normalize(cleanedOriginal);

  const newXml = xml.replace(
    /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,
    (paragraphXml) => {
      if (applied) return paragraphXml;

      const text = extractParagraphText(paragraphXml);
      const normText = normalize(text);

      // 1. Exact match
      if (normText === normOriginal) {
        applied = true;
        return rebuildParagraph(paragraphXml, replacement);
      }

      // 2. Paragraph contains the original as a substring — replace just that part
      if (normText.includes(normOriginal)) {
        applied = true;
        const newText = text.replace(cleanedOriginal.trim(), replacement);
        return rebuildParagraph(paragraphXml, newText);
      }

      return paragraphXml;
    }
  );

  zip.file("word/document.xml", newXml);
  return {
    buffer: Buffer.from(zip.generate({ type: "nodebuffer" })),
    applied,
  };
}
