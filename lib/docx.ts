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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalize(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

// Matches <w:t> and <w:t xml:space="preserve"> but NOT <w:tab>, <w:tbl>, etc.
const W_T_REGEX = /<w:t(?=[\s>\/])[^>]*>([\s\S]*?)<\/w:t>/g;

// Returns true only if the run has an active <w:b/> (not w:val="false" or "0")
function isRunBold(runXml: string): boolean {
  // Check for <w:b> or <w:b/> (excluding <w:bCs>)
  const hasBoldTag = /<w:b(?!Cs)(?:\s[^>]*)?\/?>/.test(runXml);
  if (!hasBoldTag) return false;
  // If present, check it's not explicitly disabled
  const explicitlyOff = /<w:b(?!Cs)[^>]*w:val=["'](false|0)["']/.test(runXml);
  return !explicitlyOff;
}

function extractTextFromXml(xml: string): string {
  let text = "";
  const re = new RegExp(W_T_REGEX.source, "g");
  let m;
  while ((m = re.exec(xml)) !== null) text += m[1];
  return text;
}

// Plain text only — used for matching in applyEdit
function extractParagraphText(paragraphXml: string): string {
  return decodeXmlEntities(extractTextFromXml(paragraphXml));
}

// Text with **bold** annotations — sent to AI so it can answer formatting questions
function extractParagraphTextAnnotated(paragraphXml: string): string {
  let text = "";
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let runMatch;
  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runXml = runMatch[0];
    const bold = isRunBold(runXml);
    const runText = decodeXmlEntities(extractTextFromXml(runXml));
    text += bold && runText.trim() ? `**${runText}**` : runText;
  }
  return text;
}

// Strip XML tags from AI-returned `original` fields that leaked markup
function stripXml(text: string): string {
  if (!text.includes("<")) return text;
  const tMatches = [...text.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)(?:<\/w:t>)/g)];
  if (tMatches.length > 0) return tMatches.map((m) => m[1]).join("").trim();
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface TextSegment {
  text: string;
  bold: boolean;
}

// Split "**bold** normal **bold2**" into typed segments
function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*([\s\S]*?)\*\*|([^*]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1] !== undefined && match[1]) {
      segments.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined && match[2]) {
      segments.push({ text: match[2], bold: false });
    }
  }
  return segments;
}

function addBold(rPr: string): string {
  if (!rPr) return "<w:rPr><w:b/><w:bCs/></w:rPr>";
  if (/<w:b(?!Cs)/.test(rPr)) return rPr; // already bold
  return rPr.replace("</w:rPr>", "<w:b/><w:bCs/></w:rPr>");
}

function removeBold(rPr: string): string {
  return rPr
    .replace(/<w:b(?!Cs)(?:\s[^>]*)?\/>/g, "")
    .replace(/<w:bCs(?:\s[^>]*)?\/>/g, "");
}

function makeRun(rPr: string, text: string, bold: boolean): string {
  const finalRPr = bold ? addBold(rPr) : removeBold(rPr);
  const spaceAttr =
    text.startsWith(" ") || text.endsWith(" ")
      ? ' xml:space="preserve"'
      : "";
  return `<w:r>${finalRPr}<w:t${spaceAttr}>${escapeXml(text)}</w:t></w:r>`;
}

function rebuildParagraph(paragraphXml: string, newText: string): string {
  const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const pPr = pPrMatch ? pPrMatch[0] : "";
  const rPrMatch = paragraphXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
  const baseRPr = rPrMatch ? rPrMatch[0] : "";
  const openTagMatch = paragraphXml.match(/^<w:p(?:\s[^>]*)?>/);
  const openTag = openTagMatch ? openTagMatch[0] : "<w:p>";

  const segments = parseSegments(newText);

  // No bold markers — single plain run
  if (!segments.some((s) => s.bold)) {
    const plain = newText.replace(/\*\*/g, "");
    const spaceAttr =
      plain.startsWith(" ") || plain.endsWith(" ")
        ? ' xml:space="preserve"'
        : "";
    return `${openTag}${pPr}<w:r>${baseRPr}<w:t${spaceAttr}>${escapeXml(plain)}</w:t></w:r></w:p>`;
  }

  // Mixed bold/normal — build one run per segment
  const runs = segments.map((s) => makeRun(baseRPr, s.text, s.bold)).join("");
  return `${openTag}${pPr}${runs}</w:p>`;
}

export function extractDocxParagraphs(buffer: Buffer): {
  plain: string[];
  annotated: string[];
} {
  const zip = new PizZip(buffer);
  const xml = zip.files["word/document.xml"].asText();
  const plain: string[] = [];
  const annotated: string[] = [];
  const pRegex = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let match;
  while ((match = pRegex.exec(xml)) !== null) {
    const plainText = extractParagraphText(match[0]);
    if (!plainText.trim()) continue;
    plain.push(plainText);
    annotated.push(extractParagraphTextAnnotated(match[0]));
  }
  return { plain, annotated };
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

  const cleanedOriginal = stripXml(original).replace(/\*\*/g, "");
  const normOriginal = normalize(cleanedOriginal);

  const newXml = xml.replace(
    /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g,
    (paragraphXml) => {
      if (applied) return paragraphXml;

      const text = extractParagraphText(paragraphXml);
      const normText = normalize(text);

      if (normText === normOriginal) {
        applied = true;
        return rebuildParagraph(paragraphXml, replacement);
      }

      if (normText.includes(normOriginal)) {
        applied = true;
        // For substring matches, rebuild the whole paragraph with replacement text
        const newText = text.replace(cleanedOriginal.trim(), replacement.replace(/\*\*/g, ""));
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
