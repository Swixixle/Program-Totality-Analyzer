import { createHash } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join, dirname } from "path";
import { createCanvas } from "canvas";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const PAGES_DIR = join(UPLOADS_DIR, "pages");

export interface ExtractedPage {
  pageIndex: number;
  pageText: string;
  pageTextSha256Hex: string;
  pagePngPath: string;
}

export interface AnchorProvenance {
  source_sha256_hex: string;
  source_id: string;
  page_index: number;
  page_ref: string;
  quote_start_char: number;
  quote_end_char: number;
  extractor: {
    name: "pdfjs-text-v1";
    version: "1.0.0";
  };
}

export interface ExtractedAnchorWithProvenance {
  quote: string;
  pageRef: string;
  sectionRef?: string;
  provenance: AnchorProvenance;
}

function computeSha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function splitIntoSentences(text: string): { text: string; start: number; end: number }[] {
  const sentences: { text: string; start: number; end: number }[] = [];
  const regex = /[^.!?]+[.!?]+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const trimmed = match[0].trim();
    if (trimmed.length > 0) {
      sentences.push({
        text: trimmed,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  return sentences;
}

export async function extractPdfPages(
  pdfBuffer: Buffer,
  sourceId: string
): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  
  await mkdir(join(PAGES_DIR, sourceId), { recursive: true });
  
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true
  });
  
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const pageIndex = pageNum - 1;
    
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    
    const pageTextSha256Hex = computeSha256(pageText);
    
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    
    context.fillStyle = "white";
    context.fillRect(0, 0, viewport.width, viewport.height);
    
    context.fillStyle = "black";
    context.font = "12px sans-serif";
    context.fillText(`Page ${pageNum}`, 20, 30);
    context.fillText(`Text hash: ${pageTextSha256Hex.slice(0, 16)}...`, 20, 50);
    
    const textLines = pageText.match(/.{1,80}/g) || [];
    let y = 80;
    for (const line of textLines.slice(0, 30)) {
      context.fillText(line, 20, y);
      y += 18;
    }
    if (textLines.length > 30) {
      context.fillText("...", 20, y);
    }
    
    const pngFilename = `page-${pageIndex}.png`;
    const pngPath = join(PAGES_DIR, sourceId, pngFilename);
    
    const buffer = canvas.toBuffer("image/png");
    await writeFile(pngPath, buffer);
    
    const relativePngPath = `/uploads/pages/${sourceId}/${pngFilename}`;
    
    pages.push({
      pageIndex,
      pageText,
      pageTextSha256Hex,
      pagePngPath: relativePngPath
    });
  }
  
  return pages;
}

export function extractAnchorsWithProvenance(
  pages: ExtractedPage[],
  sourceId: string,
  sourceSha256Hex: string
): ExtractedAnchorWithProvenance[] {
  const anchors: ExtractedAnchorWithProvenance[] = [];
  
  for (const page of pages) {
    const sentences = splitIntoSentences(page.pageText);
    
    let i = 0;
    while (i < sentences.length) {
      const windowSize = Math.min(2 + (i % 3), 4);
      const endIdx = Math.min(i + windowSize, sentences.length);
      
      if (endIdx <= i) {
        i++;
        continue;
      }
      
      let startChar = sentences[i].start;
      let endChar = sentences[endIdx - 1].end;
      let quote = page.pageText.slice(startChar, endChar);
      
      const leadingSpaces = quote.length - quote.trimStart().length;
      const trailingSpaces = quote.length - quote.trimEnd().length;
      startChar += leadingSpaces;
      endChar -= trailingSpaces;
      quote = page.pageText.slice(startChar, endChar);
      
      if (quote.length >= 20) {
        const provenance: AnchorProvenance = {
          source_sha256_hex: sourceSha256Hex,
          source_id: sourceId,
          page_index: page.pageIndex,
          page_ref: `p. ${page.pageIndex + 1}`,
          quote_start_char: startChar,
          quote_end_char: endChar,
          extractor: {
            name: "pdfjs-text-v1",
            version: "1.0.0"
          }
        };
        
        anchors.push({
          quote,
          pageRef: `p. ${page.pageIndex + 1}`,
          sectionRef: undefined,
          provenance
        });
      }
      
      i = endIdx;
    }
  }
  
  return anchors;
}

export async function readPdfFromPath(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
