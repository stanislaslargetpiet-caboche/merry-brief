// Scan de papiers : pages photographiées → un seul PDF, sans dépendance.
// Chaque page est une image JPEG intégrée telle quelle (filtre DCTDecode) ; la page du PDF
// a le format de la photo, à 595 points de large (A4).

const PDF_WIDTH = 595;
const SCAN_MAX_SIDE = 1800; // côté le plus long, en pixels : lisible à l'impression, léger à l'envoi

const enc = new TextEncoder();

// jpegs : [{ bytes: Uint8Array, width, height }] → Uint8Array du PDF
export function jpegsToPdf(pages) {
  if (!pages.length) throw new Error("Aucune page");
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (data) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (n, body, stream) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) {
      push("stream\n");
      push(stream);
      push("\nendstream\n");
    }
    push("endobj\n");
  };

  // 1 : catalogue, 2 : liste des pages, puis pour la page i : 3+3i page, 4+3i contenu, 5+3i image
  push("%PDF-1.4\n%âãÏÓ\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ");
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const h = Math.round((PDF_WIDTH * p.height) / p.width);
    const content = enc.encode(`q ${PDF_WIDTH} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    object(3 + 3 * i, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${h}] /Resources << /XObject << /Im0 ${5 + 3 * i} 0 R >> >> /Contents ${4 + 3 * i} 0 R >>`);
    object(4 + 3 * i, `<< /Length ${content.length} >>`, content);
    object(5 + 3 * i, `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>`, p.bytes);
  });

  const count = 3 + 3 * pages.length;
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Navigateur : photo → JPEG réduit (et, au choix, en noir et blanc contrasté)
// ---------------------------------------------------------------------------

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

// Gris + étirement des niveaux : un papier photographié à l'ombre redevient blanc et lisible
function blackAndWhite(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = g;
    hist[g | 0] += 1;
  }
  const total = w * h;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.2) {
      hi = v;
      break;
    }
  }
  if (hi - lo < 40) {
    lo = 0;
    hi = 255;
  }
  const scale = 255 / (hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, (px[i] - lo) * scale));
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

// file : photo prise ou choisie → { bytes, width, height } en JPEG
export async function photoToJpeg(file, { bw = false } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, SCAN_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * k));
    const height = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    if (bw) blackAndWhite(ctx, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", bw ? 0.7 : 0.8));
    if (!blob) throw new Error("jpeg");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Plusieurs photos → un PDF prêt à déposer
export async function scanToPdf(files, { bw = false } = {}) {
  const pages = [];
  for (const f of files) pages.push(await photoToJpeg(f, { bw }));
  return new Blob([jpegsToPdf(pages)], { type: "application/pdf" });
}
