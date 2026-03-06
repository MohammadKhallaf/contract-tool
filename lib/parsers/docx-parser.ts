/**
 * Extracts plain text + embedded images from a .docx file client-side.
 * Zero dependencies — uses ZIP Central Directory parsing + browser DecompressionStream.
 *
 * Images in word/media/* are extracted as base64 data URLs.
 * Their positions in the text are marked as [Image 1], [Image 2], etc.
 */

const SIG_LOCAL = 0x04034b50;
const SIG_CD = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function u16(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}
function u32(b: Uint8Array, o: number) {
  return ((b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0);
}

interface CDEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

function findEOCD(b: Uint8Array): number {
  for (let i = b.length - 22; i >= 0; i--) {
    if (u32(b, i) === SIG_EOCD) return i;
  }
  throw new Error("Not a valid ZIP file (EOCD not found)");
}

function parseCentralDirectory(b: Uint8Array): CDEntry[] {
  const eocdOffset = findEOCD(b);
  const cdSize = u32(b, eocdOffset + 12);
  const cdOffset = u32(b, eocdOffset + 16);

  const entries: CDEntry[] = [];
  let pos = cdOffset;

  while (pos < cdOffset + cdSize) {
    if (u32(b, pos) !== SIG_CD) break;

    const compressionMethod = u16(b, pos + 10);
    const compressedSize = u32(b, pos + 20);
    const uncompressedSize = u32(b, pos + 24);
    const filenameLen = u16(b, pos + 28);
    const extraLen = u16(b, pos + 30);
    const commentLen = u16(b, pos + 32);
    const localHeaderOffset = u32(b, pos + 42);

    const filename = new TextDecoder("utf-8").decode(
      b.subarray(pos + 46, pos + 46 + filenameLen)
    );

    entries.push({ filename, compressedSize, uncompressedSize, compressionMethod, localHeaderOffset });
    pos += 46 + filenameLen + extraLen + commentLen;
  }

  return entries;
}

function getDataOffset(b: Uint8Array, localHeaderOffset: number): number {
  if (u32(b, localHeaderOffset) !== SIG_LOCAL) {
    throw new Error("Local file header signature mismatch");
  }
  const filenameLen = u16(b, localHeaderOffset + 26);
  const extraLen = u16(b, localHeaderOffset + 28);
  return localHeaderOffset + 30 + filenameLen + extraLen;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(compressed);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function extractEntry(b: Uint8Array, entry: CDEntry): Promise<Uint8Array> {
  const dataOffset = getDataOffset(b, entry.localHeaderOffset);
  if (entry.compressionMethod === 0) {
    return b.subarray(dataOffset, dataOffset + entry.compressedSize);
  } else if (entry.compressionMethod === 8) {
    return inflateRaw(b.subarray(dataOffset, dataOffset + entry.compressedSize));
  }
  throw new Error(`Unsupported ZIP compression method: ${entry.compressionMethod}`);
}

function mimeForFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    tiff: "image/tiff",
    tif: "image/tiff",
    emf: "image/x-emf",
    wmf: "image/x-wmf",
  };
  return map[ext] ?? "image/png";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Build a map from relationship id (e.g. "rId1") → media filename
 * by parsing word/_rels/document.xml.rels
 */
function parseRels(xml: string): Map<string, string> {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const map = new Map<string, string>();
  for (const rel of Array.from(doc.getElementsByTagName("Relationship"))) {
    const id = rel.getAttribute("Id") ?? "";
    const target = rel.getAttribute("Target") ?? "";
    // e.g. Target="media/image1.png"
    if (target.startsWith("media/")) {
      map.set(id, target.split("/").pop() ?? target);
    }
  }
  return map;
}

/**
 * Extract drawing relationship ids from document.xml in document order.
 * Each <w:drawing> contains an <a:blip r:embed="rIdN"/> that links to the image.
 */
function extractDrawingRids(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  const rids: string[] = [];
  // <a:blip r:embed="rIdN">
  for (const blip of Array.from(doc.getElementsByTagNameNS(NS_A, "blip"))) {
    const rid = blip.getAttributeNS(NS_R, "embed");
    if (rid) rids.push(rid);
  }
  return rids;
}

/**
 * Convert document XML to text, inserting [Image N] markers at <w:drawing> positions.
 * Returns the text with markers in place.
 */
function xmlToTextWithMarkers(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Failed to parse word/document.xml");
  }

  const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  // Build rid → image index map (order of first appearance)
  const ridOrder: string[] = [];
  const ridToIndex = new Map<string, number>();
  for (const blip of Array.from(doc.getElementsByTagNameNS(NS_A, "blip"))) {
    const rid = blip.getAttributeNS(NS_R, "embed");
    if (rid && !ridToIndex.has(rid)) {
      ridToIndex.set(rid, ridOrder.length + 1);
      ridOrder.push(rid);
    }
  }

  const paragraphs = doc.getElementsByTagNameNS(NS_W, "p");
  const lines: string[] = [];

  for (const para of Array.from(paragraphs)) {
    const parts: string[] = [];

    // Walk child runs and drawings in order
    for (const child of Array.from(para.childNodes)) {
      const el = child as Element;

      // <w:r> run — collect <w:t> text
      if (el.localName === "r" && el.namespaceURI === NS_W) {
        for (const t of Array.from(el.getElementsByTagNameNS(NS_W, "t"))) {
          parts.push(t.textContent ?? "");
        }
        // Check for drawing inside run
        for (const blip of Array.from(el.getElementsByTagNameNS(NS_A, "blip"))) {
          const rid = blip.getAttributeNS(NS_R, "embed");
          if (rid && ridToIndex.has(rid)) {
            parts.push(`[Image ${ridToIndex.get(rid)}]`);
          }
        }
      }

      // <w:drawing> directly in paragraph
      if (el.localName === "drawing" && el.namespaceURI === NS_W) {
        for (const blip of Array.from(el.getElementsByTagNameNS(NS_A, "blip"))) {
          const rid = blip.getAttributeNS(NS_R, "embed");
          if (rid && ridToIndex.has(rid)) {
            parts.push(`[Image ${ridToIndex.get(rid)}]`);
          }
        }
      }
    }

    lines.push(parts.join(""));
  }

  return lines.join("\n").trim();
}

export interface DocxExtractResult {
  text: string;
  /** base64 data URLs for embedded images, in document order */
  imageDataUrls: string[];
  /** human-readable names for each image, e.g. "Document Image 1 (image1.png)" */
  imageNames: string[];
}

export async function extractDocxText(file: File): Promise<DocxExtractResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const entries = parseCentralDirectory(buf);

  const byFilename = new Map(entries.map((e) => [e.filename, e]));

  // --- Parse relationships ---
  const relsEntry = byFilename.get("word/_rels/document.xml.rels");
  const ridToFilename = relsEntry
    ? parseRels(new TextDecoder("utf-8").decode(await extractEntry(buf, relsEntry)))
    : new Map<string, string>();

  // --- Extract document XML ---
  const docEntry = byFilename.get("word/document.xml");
  if (!docEntry) {
    const names = entries.map((e) => e.filename).join(", ");
    throw new Error(`word/document.xml not found. Entries: ${names || "(none)"}`);
  }
  const docXml = new TextDecoder("utf-8").decode(await extractEntry(buf, docEntry));

  // --- Extract text with [Image N] markers ---
  const text = xmlToTextWithMarkers(docXml);

  // --- Extract images in document order ---
  const drawingRids = extractDrawingRids(docXml);
  // deduplicate while preserving order
  const seenRids = new Set<string>();
  const orderedRids: string[] = [];
  for (const rid of drawingRids) {
    if (!seenRids.has(rid)) { seenRids.add(rid); orderedRids.push(rid); }
  }

  const imageDataUrls: string[] = [];
  const imageNames: string[] = [];

  for (let i = 0; i < orderedRids.length; i++) {
    const rid = orderedRids[i];
    const mediaFilename = ridToFilename.get(rid);
    if (!mediaFilename) continue;

    const mediaEntry = byFilename.get(`word/media/${mediaFilename}`);
    if (!mediaEntry) continue;

    try {
      const bytes = await extractEntry(buf, mediaEntry);
      const mime = mimeForFilename(mediaFilename);
      const b64 = uint8ToBase64(bytes);
      imageDataUrls.push(`data:${mime};base64,${b64}`);
      imageNames.push(`Document Image ${i + 1} (${mediaFilename})`);
    } catch {
      // skip unreadable images
    }
  }

  return { text, imageDataUrls, imageNames };
}
