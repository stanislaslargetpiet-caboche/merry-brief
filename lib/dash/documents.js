// Documents : dossiers, types de fichiers et tailles.

import { PASTEL_KEYS } from "./theme";

// Dossiers proposés à la création (un clic suffit)
export const FOLDER_SUGGESTIONS = ["Factures et devis", "Mairie", "Préparation religieuse", "Lieu et traiteur", "Faire-part et papeterie", "Voyage de noces", "Tenues", "Témoins"];

// Pseudo-dossier des devis et factures ajoutés depuis le budget sans dossier
export const BUDGET_FOLDER = { id: "budget", name: "Devis et factures du budget", color: "jaune", virtual: true };

export function nextFolderColor(folders) {
  const used = folders.map((f) => f.color);
  return PASTEL_KEYS.find((k) => !used.includes(k)) || PASTEL_KEYS[folders.length % PASTEL_KEYS.length];
}

// Type lisible d'un document : « PDF », « JPG », « DOC »… et sa couleur de badge
const TYPES = {
  pdf: { label: "PDF", key: "peche" },
  jpg: { label: "JPG", key: "bleu" },
  jpeg: { label: "JPG", key: "bleu" },
  png: { label: "PNG", key: "bleu" },
  heic: { label: "HEIC", key: "bleu" },
  webp: { label: "WEBP", key: "bleu" },
  gif: { label: "GIF", key: "bleu" },
  doc: { label: "DOC", key: "lavande" },
  docx: { label: "DOC", key: "lavande" },
  pages: { label: "DOC", key: "lavande" },
  odt: { label: "DOC", key: "lavande" },
  xls: { label: "XLS", key: "sauge" },
  xlsx: { label: "XLS", key: "sauge" },
  numbers: { label: "XLS", key: "sauge" },
  csv: { label: "CSV", key: "sauge" },
  ppt: { label: "PPT", key: "jaune" },
  pptx: { label: "PPT", key: "jaune" },
  key: { label: "KEY", key: "jaune" },
  zip: { label: "ZIP", key: "gris" },
  txt: { label: "TXT", key: "gris" },
};

export function docType(doc) {
  const name = doc?.name || "";
  const m = name.match(/\.([a-z0-9]{2,5})$/i);
  const ext = m ? m[1].toLowerCase() : null;
  if (ext && TYPES[ext]) return TYPES[ext];
  const mime = doc?.mime || "";
  if (/pdf/.test(mime)) return TYPES.pdf;
  if (/^image\//.test(mime)) return TYPES.jpg;
  if (/word|opendocument\.text/.test(mime)) return TYPES.docx;
  if (/sheet|excel|csv/.test(mime)) return TYPES.xlsx;
  if (/presentation|powerpoint/.test(mime)) return TYPES.pptx;
  if (doc?.url && !doc?.storage_path) return { label: "LIEN", key: "gris" };
  return { label: "FICH.", key: "gris" };
}

// Nom sans son extension, pour l'affichage
export function docTitle(doc) {
  return (doc?.name || "Document").replace(/\.[a-z0-9]{2,5}$/i, "");
}

export function fileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  const mo = n / (1024 * 1024);
  return `${(mo < 10 ? mo.toFixed(1) : Math.round(mo)).toString().replace(".", ",")} Mo`;
}

export function folderDocs(documents, folderId) {
  if (folderId === BUDGET_FOLDER.id) return documents.filter((d) => !d.folder_id);
  return documents.filter((d) => d.folder_id === folderId);
}

// Liste des dossiers affichés : les vrais, puis le pseudo-dossier du budget s'il contient quelque chose
export function allFolders(data) {
  const list = [...(data.folders || [])].sort((a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at)));
  if (data.documents.some((d) => !d.folder_id)) list.push(BUDGET_FOLDER);
  return list;
}

export function findFolder(data, id) {
  if (id === BUDGET_FOLDER.id) return BUDGET_FOLDER;
  return (data.folders || []).find((f) => f.id === id) || null;
}

export function totalBytes(documents) {
  return documents.reduce((a, d) => a + (Number(d.size_bytes) || 0), 0);
}

export function sortRecent(documents) {
  return [...documents].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

// Lien collé (Drive, Dropbox, WeTransfer…) : adresse nettoyée, ou null si ce n'est pas une adresse web
export function normalizeLink(text) {
  let s = String(text || "").trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Nom proposé pour un lien, d'après le service d'où il vient
export function linkName(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Lien";
  }
  if (/drive\.google|docs\.google/.test(host)) return "Document Google Drive";
  if (/dropbox/.test(host)) return "Document Dropbox";
  if (/icloud/.test(host)) return "Document iCloud";
  if (/onedrive|1drv|sharepoint/.test(host)) return "Document OneDrive";
  if (/wetransfer|we\.tl/.test(host)) return "Fichier WeTransfer";
  return host;
}
