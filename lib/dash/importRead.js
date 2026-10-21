// Lecture des fichiers d'invités dans le navigateur, quel que soit le format.
// Chaque fichier devient des « parties » envoyées à l'IA (texte découpé, page de PDF,
// photo), plus une lecture locale colonne par colonne quand c'est un tableau ou du texte.

import { parseRows, parseText } from "./importParse";

export const MAX_TEXT_ROWS = 40; // lignes de tableau par partie : réponse courte, sous la limite de temps
export const MAX_TEXT_LINES = 60; // lignes de notes par partie
const MAX_PDF_PAGES = 30;
const MAX_PART_BYTES = 3 * 1024 * 1024; // une partie (photo, page) reste sous la limite d'envoi de Vercel

export const KIND_BADGES = {
  xls: ["XLS", "#e5eadc", "#3f5a31"],
  csv: ["CSV", "#e5eadc", "#3f5a31"],
  doc: ["DOC", "#e0ebf6", "#2b5479"],
  img: ["IMG", "#fbe5dc", "#8c4229"],
  pdf: ["PDF", "#fbe5dc", "#8c4229"],
  txt: ["TXT", "#ebe6fb", "#4a3d99"],
};

const UNSUPPORTED = {
  xls: "Ancien format Excel (.xls) : ouvrez-le et enregistrez-le en .xlsx, ou exportez-le en PDF.",
  numbers: "Fichier Numbers : exportez-le en Excel (Fichier › Exporter vers › Excel).",
  pages: "Fichier Pages : exportez-le en PDF ou en Word.",
  doc: "Ancien format Word (.doc) : enregistrez-le en .docx ou en PDF.",
  heic: "Photo HEIC : faites une capture d'écran de la photo, ou exportez-la en JPEG.",
};

function ext(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function kindOf(file) {
  const e = ext(file.name);
  const t = file.type || "";
  if (["xlsx", "xlsm", "xltx", "xltm"].includes(e)) return "xlsx";
  if (e === "ods") return "ods";
  if (["csv", "tsv"].includes(e) || t === "text/csv") return "csv";
  if (e === "docx" || e === "dotx") return "docx";
  if (e === "odt") return "odt";
  if (e === "pdf" || t === "application/pdf") return "pdf";
  if (e === "heic" || e === "heif" || /heic|heif/.test(t)) return "heic";
  if (/^image\//.test(t) || ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(e)) return "img";
  if (["txt", "md", "text", "rtf", "html", "htm", "eml", "vcf", "json"].includes(e) || /^text\//.test(t)) return "txt";
  if (e === "xls") return "xls";
  if (e === "numbers") return "numbers";
  if (e === "pages") return "pages";
  if (e === "doc") return "doc";
  return "unknown";
}

export function badgeOf(kind) {
  if (kind === "xlsx" || kind === "ods" || kind === "xls" || kind === "numbers") return KIND_BADGES.xls;
  if (kind === "doc" || kind === "pages") return KIND_BADGES.doc;
  if (kind === "csv") return KIND_BADGES.csv;
  if (kind === "docx" || kind === "odt") return KIND_BADGES.doc;
  if (kind === "pdf") return KIND_BADGES.pdf;
  if (kind === "img" || kind === "heic") return KIND_BADGES.img;
  return KIND_BADGES.txt;
}

// Texte : UTF-8, sinon Windows-1252 (CSV enregistrés par Excel sur Windows)
export function decodeText(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function cleanCell(c) {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toLocaleDateString("fr-FR");
  return String(c).replace(/[\t\r\n]+/g, " ").trim();
}

function rowsToText(rows) {
  return rows.map((r) => r.map(cleanCell).join("\t")).join("\n");
}

// Un tableau en parties de MAX_TEXT_ROWS lignes ; les suivantes rappellent les premières lignes (en-têtes)
export function tableUnits(rows, label) {
  const clean = rows.map((r) => (Array.isArray(r) ? r : [r]).map(cleanCell)).filter((r) => r.some(Boolean));
  if (!clean.length) return [];
  const units = [];
  const head = clean.slice(0, 3);
  for (let i = 0; i < clean.length; i += MAX_TEXT_ROWS) {
    const part = clean.slice(i, i + MAX_TEXT_ROWS);
    units.push({
      kind: "text",
      label,
      content: rowsToText(part),
      context: i > 0 ? rowsToText(head) : undefined,
    });
  }
  return units;
}

export function textUnits(text, label) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const kept = lines.filter((l) => l.trim());
  if (!kept.length) return [];
  const units = [];
  for (let i = 0; i < kept.length; i += MAX_TEXT_LINES) {
    units.push({ kind: "text", label, content: kept.slice(i, i + MAX_TEXT_LINES).join("\n"), context: i > 0 ? kept.slice(0, 2).join("\n") : undefined });
  }
  return units;
}

function splitDelimited(text) {
  // Réutilise le découpage local : renvoie les lignes en cellules si le texte est un tableau
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const sample = lines.slice(0, 15);
  for (const d of ["\t", ";", ","]) {
    const counts = sample.map((l) => l.split(d).length);
    if (counts.length && counts.filter((c) => c > 1).length >= Math.ceil(counts.length * 0.7)) {
      return lines.map((l) => {
        if (d === "\t") return l.split("\t");
        const out = [];
        let cur = "";
        let q = false;
        for (let i = 0; i < l.length; i += 1) {
          const ch = l[i];
          if (ch === '"') {
            if (q && l[i + 1] === '"') {
              cur += '"';
              i += 1;
            } else q = !q;
          } else if (ch === d && !q) {
            out.push(cur);
            cur = "";
          } else cur += ch;
        }
        out.push(cur);
        return out;
      });
    }
  }
  return null;
}

async function unzip(file) {
  const { unzipSync } = await import("fflate");
  return unzipSync(new Uint8Array(await file.arrayBuffer()));
}

function xmlText(bytes) {
  return new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml");
}

// Word : paragraphes et tableaux (une ligne de tableau = cellules séparées par des tabulations)
async function readDocx(file) {
  const files = await unzip(file);
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("illisible");
  const xml = xmlText(doc);
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const body = xml.getElementsByTagNameNS(W, "body")[0];
  const lines = [];
  const textOf = (el) =>
    Array.from(el.getElementsByTagNameNS(W, "p"))
      .map((p) => Array.from(p.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join(""))
      .join(" ")
      .trim();
  for (const node of Array.from(body?.childNodes || [])) {
    if (node.localName === "tbl") {
      for (const tr of Array.from(node.getElementsByTagNameNS(W, "tr"))) {
        lines.push(Array.from(tr.getElementsByTagNameNS(W, "tc")).map(textOf).join("\t"));
      }
    } else if (node.localName === "p") {
      lines.push(Array.from(node.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join(""));
    }
  }
  return lines.join("\n");
}

// OpenDocument : feuilles de calcul (.ods) et textes (.odt)
async function readOpenDocument(file, kind) {
  const files = await unzip(file);
  const content = files["content.xml"];
  if (!content) throw new Error("illisible");
  const xml = xmlText(content);
  const T = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
  const X = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
  const cellText = (c) => Array.from(c.getElementsByTagNameNS(X, "p")).map((p) => p.textContent).join(" ").trim();
  if (kind === "ods") {
    return Array.from(xml.getElementsByTagNameNS(T, "table")).map((t) => ({
      sheet: t.getAttributeNS(T, "name") || "Feuille",
      data: Array.from(t.getElementsByTagNameNS(T, "table-row")).map((r) => {
        const cells = [];
        for (const c of Array.from(r.getElementsByTagNameNS(T, "table-cell"))) {
          const rep = Math.min(Number(c.getAttributeNS(T, "number-columns-repeated") || 1), 50);
          const v = cellText(c);
          for (let i = 0; i < rep; i += 1) cells.push(v);
        }
        while (cells.length && !cells[cells.length - 1]) cells.pop();
        return cells;
      }),
    }));
  }
  return Array.from(xml.getElementsByTagNameNS(X, "p"))
    .map((p) => p.textContent)
    .join("\n");
}

function toBase64(bytes) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

// PDF : une partie par page, lues en parallèle par l'IA
async function readPdf(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const n = Math.min(src.getPageCount(), MAX_PDF_PAGES);
    if (n <= 1 && buf.length <= MAX_PART_BYTES) return { units: [{ kind: "pdf", mime: "application/pdf", content: toBase64(buf), label: "page 1" }], pages: 1 };
    const units = [];
    for (let i = 0; i < n; i += 1) {
      const one = await PDFDocument.create();
      const [page] = await one.copyPages(src, [i]);
      one.addPage(page);
      const bytes = await one.save();
      if (bytes.length > MAX_PART_BYTES) throw new Error("page trop lourde");
      units.push({ kind: "pdf", mime: "application/pdf", content: toBase64(bytes), label: `page ${i + 1}` });
    }
    return { units, pages: src.getPageCount() };
  } catch (e) {
    if (buf.length > MAX_PART_BYTES) throw new Error("PDF trop lourd");
    return { units: [{ kind: "pdf", mime: "application/pdf", content: toBase64(buf), label: "PDF" }], pages: null };
  }
}

// Photo réduite à 1800 px (JPEG) : assez pour lire une liste écrite à la main
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function sheetsLocal(sheets) {
  const many = sheets.filter((s) => s.data.some((r) => r.some((c) => cleanCell(c)))).length > 1;
  const guests = [];
  const extra = new Set();
  for (const s of sheets) {
    const res = parseRows(s.data);
    for (const g of res.guests) guests.push(many && !g.group ? { ...g, group: s.sheet } : g);
    res.extraColumns.forEach((c) => extra.add(c));
  }
  return { guests, extraColumns: [...extra] };
}

// Lit un fichier : { kind, note, units, local: { guests, extraColumns } | null }
export async function readFile(file) {
  const kind = kindOf(file);
  if (UNSUPPORTED[kind]) throw Object.assign(new Error("unsupported"), { note: UNSUPPORTED[kind], kind });

  if (kind === "xlsx" || kind === "ods") {
    let sheets;
    if (kind === "xlsx") {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      sheets = await readXlsxFile(file);
    } else sheets = await readOpenDocument(file, "ods");
    sheets = sheets.filter((s) => s.data.some((r) => r.some((c) => cleanCell(c))));
    const units = sheets.flatMap((s) => tableUnits(s.data, sheets.length > 1 ? `feuille « ${s.sheet} »` : ""));
    const rows = sheets.reduce((a, s) => a + s.data.filter((r) => r.some((c) => cleanCell(c))).length, 0);
    const note = sheets.length > 1 ? `${sheets.length} feuilles · ${rows} lignes` : `${rows} lignes`;
    return { kind, note, units, local: sheetsLocal(sheets) };
  }

  if (kind === "csv" || kind === "txt" || kind === "unknown") {
    const text = decodeText(await file.arrayBuffer());
    // eslint-disable-next-line no-control-regex
    if (kind === "unknown" && /[\u0000-\u0008\u000e-\u001f]/.test(text.slice(0, 2000))) {
      throw Object.assign(new Error("unsupported"), { note: "Format non reconnu : essayez Excel, CSV, Word, PDF ou une photo.", kind });
    }
    const plain = /\.(html?|eml)$/i.test(file.name) ? new DOMParser().parseFromString(text, "text/html").body?.innerText || text : text;
    const rows = splitDelimited(plain);
    if (rows) return { kind: "csv", note: `${rows.length} lignes`, units: tableUnits(rows, ""), local: parseRows(rows) };
    const n = plain.split("\n").filter((l) => l.trim()).length;
    return { kind: "txt", note: `Notes · ${n} lignes`, units: textUnits(plain, ""), local: parseText(plain) };
  }

  if (kind === "docx" || kind === "odt") {
    const text = kind === "docx" ? await readDocx(file) : await readOpenDocument(file, "odt");
    const rows = text.split("\n").filter((l) => l.includes("\t"));
    const n = text.split("\n").filter((l) => l.trim()).length;
    const local = rows.length > n / 2 ? parseRows(text.split("\n").filter((l) => l.trim()).map((l) => l.split("\t"))) : parseText(text);
    return { kind, note: `Document · ${n} lignes`, units: textUnits(text, ""), local };
  }

  if (kind === "pdf") {
    const { units, pages } = await readPdf(file);
    return { kind, note: pages ? `PDF · ${pages} page${pages > 1 ? "s" : ""}` : "PDF", units, local: null };
  }

  if (kind === "img") {
    let content;
    try {
      content = await shrinkImage(file);
    } catch {
      throw Object.assign(new Error("unsupported"), { note: UNSUPPORTED.heic, kind });
    }
    return { kind, note: "Photo d'une liste", units: [{ kind: "image", mime: "image/jpeg", content, label: "" }], local: null };
  }

  throw Object.assign(new Error("unsupported"), { note: "Format non reconnu : essayez Excel, CSV, Word, PDF ou une photo.", kind });
}

export function pastedEntry(text) {
  const rows = splitDelimited(text);
  if (rows) return { kind: "csv", note: `Liste collée · ${rows.length} lignes`, units: tableUnits(rows, ""), local: parseRows(rows) };
  const n = text.split("\n").filter((l) => l.trim()).length;
  return { kind: "txt", note: `Liste collée · ${n} lignes`, units: textUnits(text, ""), local: parseText(text) };
}
