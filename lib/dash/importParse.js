// Lecture locale des listes d'invités (CSV, Excel, notes collées), sans IA.
// L'IA (route /api/import-invites) prend le relais pour les photos, les PDF et
// les listes en vrac quand la clé est configurée.

import { normalize } from "./format";

const EMAIL_RE = /[^\s,;<>()]+@[^\s,;<>()]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/;

const HEADER_MAP = [
  [/^(pr[ée]nom|first ?name|prenom)$/, "first_name"],
  [/^(nom de famille|last ?name|surname|nom)$/, "last_name"],
  [/^(nom complet|name|invit[ée]s?|personne|full ?name|nom et pr[ée]nom|pr[ée]nom et nom)$/, "full"],
  [/^(e-?mail|mail|courriel|adresse mail|adresse e-?mail)$/, "email"],
  [/^(t[ée]l[ée]phone|tel|t[ée]l|portable|mobile|phone)$/, "phone"],
  [/^(adresse|address|adresse postale|rue)$/, "address"],
  [/^(code postal|cp|zip)$/, "zip"],
  [/^(ville|city|commune)$/, "city"],
  [/^(r[ée]gime|allergies?|r[ée]gime alimentaire|diet|menu)$/, "diet"],
  [/^([âa]ge|age)$/, "age"],
  [/^(groupe|famille|c[ôo]t[ée]|cercle|group)$/, "group"],
];

function headerKey(h) {
  const n = normalize(h).replace(/\s+/g, " ");
  for (const [re, key] of HEADER_MAP) if (re.test(n)) return key;
  return null;
}

function splitLine(line, delim) {
  if (delim === "\t") return line.split("\t");
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function detectDelimiter(lines) {
  const sample = lines.slice(0, 10);
  for (const d of ["\t", ";", ","]) {
    const counts = sample.map((l) => splitLine(l, d).length);
    if (counts.length && counts.every((c) => c > 1) && counts.filter((c) => c === counts[0]).length >= Math.ceil(counts.length * 0.7)) return d;
  }
  return null;
}

function splitName(s) {
  const clean = String(s || "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = clean.split(" ");
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

// Une ligne de notes : « Claire Morel, claire@gmail.com », « Louise Martin +1 », « Léo Dubois (8 ans) »
function parseFreeLine(line) {
  let rest = line.replace(/^[-*•\d.)\s]+/, "").trim();
  if (!rest) return [];
  const guest = { extra: {} };
  const email = rest.match(EMAIL_RE);
  if (email) {
    guest.email = email[0];
    rest = rest.replace(email[0], " ");
  }
  const phone = rest.match(PHONE_RE);
  if (phone) {
    guest.phone = phone[0];
    rest = rest.replace(phone[0], " ");
  }
  const age = rest.match(/\(?(\d{1,2})\s?ans\)?/i);
  if (age) {
    guest.age = Number(age[1]);
    rest = rest.replace(age[0], " ");
  }
  let plusOne = false;
  if (/\+\s?1\b|et (son|sa) (conjoint|conjointe|copain|copine|compagnon|compagne)/i.test(rest)) {
    plusOne = true;
    rest = rest.replace(/\+\s?1\b|et (son|sa) (conjoint|conjointe|copain|copine|compagnon|compagne)/i, " ");
  }
  rest = rest.replace(/[,;:|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!rest) return [];
  // « Marc et Anne Dubois » : deux invités
  const couple = rest.match(/^([A-ZÀ-Ý][\p{L}'-]+) (?:et|&) ([A-ZÀ-Ý][\p{L}'-]+) (.+)$/u);
  const out = [];
  if (couple) {
    out.push({ ...guest, first_name: couple[1], last_name: couple[3] });
    out.push({ first_name: couple[2], last_name: couple[3], extra: {} });
  } else {
    const n = splitName(rest);
    out.push({ ...guest, ...n, uncertain: !n.last_name || /famille|cousins?|tante|oncle|mamie|papi|\?/i.test(rest), note: !n.last_name ? "Nom de famille manquant" : undefined });
  }
  if (plusOne) out.push({ first_name: "", last_name: "", plusOneOfIndex: out.length - 1, extra: {} });
  return out;
}

export function parseRows(rows) {
  // rows : tableau de tableaux (Excel) ou lignes découpées (CSV)
  const clean = rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim()))).filter((r) => r.some(Boolean));
  if (!clean.length) return { guests: [], extraColumns: [] };
  const header = clean[0].map(headerKey);
  const hasHeader = header.filter(Boolean).length >= 1 && header.some((k) => ["first_name", "last_name", "full", "email"].includes(k));
  if (!hasHeader) {
    // Pas d'en-tête : première colonne = nom complet, on cherche mail et téléphone dans le reste
    return { guests: clean.flatMap((r) => parseFreeLine(r.join(", "))), extraColumns: [] };
  }
  const extraIdx = clean[0].map((h, i) => (!header[i] && h ? i : null)).filter((i) => i !== null);
  const extraColumns = extraIdx.map((i) => clean[0][i]);
  const guests = [];
  for (const r of clean.slice(1)) {
    const g = { extra: {} };
    header.forEach((key, i) => {
      const v = r[i];
      if (!v || !key) return;
      if (key === "full") Object.assign(g, splitName(v));
      else if (key === "age") g.age = Number.parseInt(v, 10) || null;
      else g[key] = v;
    });
    if (g.zip || g.city) g.address = [g.address, [g.zip, g.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    delete g.zip;
    delete g.city;
    extraIdx.forEach((i) => {
      if (r[i]) g.extra[clean[0][i]] = r[i];
    });
    if (!g.first_name && !g.last_name) continue;
    if (!g.last_name && g.first_name && g.first_name.includes(" ")) Object.assign(g, splitName(g.first_name));
    guests.push(g);
  }
  return { guests, extraColumns };
}

export function parseText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { guests: [], extraColumns: [] };
  const delim = detectDelimiter(lines);
  if (delim) return parseRows(lines.map((l) => splitLine(l, delim)));
  return { guests: lines.flatMap(parseFreeLine), extraColumns: [] };
}

export function guestKey(g) {
  return normalize(`${g.first_name || ""} ${g.last_name || ""}`);
}
