import PizZip from "pizzip";
import mammoth from "mammoth";
import { DOMParser, XMLSerializer, Node, Element, Document } from "@xmldom/xmldom";

function normalize(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function stripXml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface TextSegment {
  text: string;
  bold: boolean;
}

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

function extractTextFromNode(node: Node): string {
  let text = "";
  if (node.nodeType === 3) { // TEXT_NODE
    text += node.nodeValue || "";
  } else if (node.nodeType === 1) { // ELEMENT_NODE
    const el = node as Element;
    if (el.tagName === "w:t") {
      text += el.textContent || "";
    } else {
      for (let i = 0; i < el.childNodes.length; i++) {
        text += extractTextFromNode(el.childNodes[i]);
      }
    }
  }
  return text;
}

function isRunBold(runEl: Element): boolean {
  const rPrs = runEl.getElementsByTagName("w:rPr");
  if (rPrs.length === 0) return false;
  const rPr = rPrs[0];

  let hasBoldTag = false;
  let isExplicitlyOff = false;

  for (let i = 0; i < rPr.childNodes.length; i++) {
    const child = rPr.childNodes[i] as Element;
    if (child.tagName === "w:b") {
      hasBoldTag = true;
      const val = child.getAttribute("w:val");
      if (val === "false" || val === "0") {
        isExplicitlyOff = true;
      }
    }
  }
  return hasBoldTag && !isExplicitlyOff;
}

export function extractDocxParagraphs(buffer: Buffer): {
  plain: string[];
  annotated: string[];
} {
  const zip = new PizZip(buffer);
  const xml = zip.files["word/document.xml"].asText();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const plain: string[] = [];
  const annotated: string[] = [];

  const paragraphs = doc.getElementsByTagName("w:p");
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const plainText = extractTextFromNode(p);
    if (!plainText.trim()) continue;

    plain.push(plainText);

    let annotatedText = "";
    const runs = p.getElementsByTagName("w:r");
    for (let j = 0; j < runs.length; j++) {
      const run = runs[j];
      const bold = isRunBold(run);
      const runText = extractTextFromNode(run);
      annotatedText += bold && runText.trim() ? `**${runText}**` : runText;
    }
    annotated.push(annotatedText);
  }

  return { plain, annotated };
}

export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

function rebuildParagraphNode(doc: Document, pNode: Element, newText: string): Element {
  // Save paragraph properties (w:pPr)
  const pPrs = pNode.getElementsByTagName("w:pPr");
  const pPr = pPrs.length > 0 ? pPrs[0].cloneNode(true) : null;

  // Find a base run properties (w:rPr) to use for new runs
  let baseRPr: Node | null = null;
  const runs = pNode.getElementsByTagName("w:r");
  if (runs.length > 0) {
    const rPrs = runs[0].getElementsByTagName("w:rPr");
    if (rPrs.length > 0) {
      baseRPr = rPrs[0].cloneNode(true);
    }
  }

  // Clear existing children
  while (pNode.firstChild) {
    pNode.removeChild(pNode.firstChild);
  }

  // Append pPr back
  if (pPr) {
    pNode.appendChild(pPr);
  }

  const segments = parseSegments(newText);

  for (const segment of segments) {
    const rNode = doc.createElement("w:r");

    // Setup rPr
    let rPrNode: Element | null = null;
    if (baseRPr) {
      rPrNode = baseRPr.cloneNode(true) as Element;
    } else if (segment.bold) {
      rPrNode = doc.createElement("w:rPr");
    }

    if (rPrNode) {
      // Remove any existing w:b and w:bCs
      let toRemove: Element[] = [];
      for (let i = 0; i < rPrNode.childNodes.length; i++) {
        const child = rPrNode.childNodes[i] as Element;
        if (child.tagName === "w:b" || child.tagName === "w:bCs") {
          toRemove.push(child);
        }
      }
      toRemove.forEach(c => rPrNode!.removeChild(c));

      if (segment.bold) {
        rPrNode.appendChild(doc.createElement("w:b"));
        rPrNode.appendChild(doc.createElement("w:bCs"));
      }
      rNode.appendChild(rPrNode);
    }

    const tNode = doc.createElement("w:t");
    if (segment.text.startsWith(" ") || segment.text.endsWith(" ")) {
      tNode.setAttribute("xml:space", "preserve");
    }
    tNode.appendChild(doc.createTextNode(segment.text));
    rNode.appendChild(tNode);

    pNode.appendChild(rNode);
  }

  return pNode;
}

export function applyEdit(
  buffer: Buffer,
  original: string,
  replacement: string
): { buffer: Buffer; applied: boolean } {
  const zip = new PizZip(buffer);
  const xml = zip.files["word/document.xml"].asText();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  let applied = false;

  const cleanedOriginal = stripXml(original).replace(/\*\*/g, "");
  const normOriginal = normalize(cleanedOriginal);

  const paragraphs = doc.getElementsByTagName("w:p");
  for (let i = 0; i < paragraphs.length; i++) {
    if (applied) break;

    const pNode = paragraphs[i];
    const text = extractTextFromNode(pNode);
    const normText = normalize(text);

    if (normText === normOriginal) {
      applied = true;
      if (replacement.trim() === "") {
        pNode.parentNode?.removeChild(pNode);
      } else {
        rebuildParagraphNode(doc, pNode, replacement);
      }
    } else if (normText.includes(normOriginal)) {
      applied = true;
      const newText = text.replace(cleanedOriginal.trim(), replacement.replace(/\*\*/g, ""));
      if (newText.trim() === "") {
        pNode.parentNode?.removeChild(pNode);
      } else {
        rebuildParagraphNode(doc, pNode, newText);
      }
    }
  }

  if (applied) {
    const serializer = new XMLSerializer();
    const newXml = serializer.serializeToString(doc);
    zip.file("word/document.xml", newXml);
  }

  return {
    buffer: Buffer.from(zip.generate({ type: "nodebuffer" })),
    applied,
  };
}
