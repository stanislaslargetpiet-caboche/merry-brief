// Lecture des listes d'invités par l'IA, quel que soit le format : chaque fichier arrive
// découpé en parties (40 lignes de tableau, une page de PDF, une photo).
// Réservée aux organisateurs connectés. Nécessite ANTHROPIC_API_KEY côté serveur
// (Vercel > Settings > Environment Variables) ; sans clé, l'appli lit seulement
// les tableaux (Excel, CSV, Word) et le texte collé, colonne par colonne.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel refuse les requêtes de plus de 4,5 Mo : l'appli réduit les photos et limite les PDF à 3 Mo.
const MAX_BYTES = 4.4 * 1024 * 1024;
const MAX_TEXT = 60000;
const DAILY_LIMIT = 200; // parties lues par compte et par jour (une liste de 200 lignes = 5 parties)
const MODEL = process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const SYSTEM = `Tu lis des listes d'invités de mariage telles que les couples et leurs familles les tiennent : tableaux Excel plus ou moins rangés, exports CSV, documents Word, PDF, photos de listes écrites à la main, notes de téléphone, mails copiés.

Ton travail : retrouver chaque personne invitée et l'enregistrer avec l'outil, une entrée par personne.

Comment lire :
- L'en-tête peut être absent, sur une autre ligne que la première, ou en anglais. Les colonnes peuvent être dans n'importe quel ordre. Déduis le sens d'une colonne de son contenu (un mail, un téléphone, une adresse, un âge).
- Une ligne peut contenir plusieurs personnes : « M. et Mme Jean Dupont » = Jean Dupont + Mme Dupont (prénom inconnu : first_name vide, uncertain, note « Prénom à compléter ») ; « Jean et Marie Dupont » = deux personnes ; « Pierre Martin + 1 » ou « et sa compagne » = Pierre Martin + une entrée vide avec plus_one_of ; « Famille Leroy (4) » sans les prénoms = 4 entrées avec last_name Leroy, first_name vide, uncertain, note « Famille Leroy : prénoms à compléter » ; « les enfants Léo (8 ans) et Jade » = deux entrées avec leur âge si indiqué.
- Les titres de section (« Côté Marie », « Amis du marié », « Famille de Paul », nom de la feuille) donnent le groupe des personnes qui suivent. Choisis le groupe existant qui correspond quand c'est évident, sinon écris le groupe tel quel.
- Ignore ce qui n'est pas une personne invitée : titres, totaux, sous-totaux, dates, numéros de table seuls, lignes vides, prestataires.
- Retire les titres (M., Mme, Dr, Me) des prénoms. Mets les noms en casse normale (« DUPONT » → « Dupont »).
- Les colonnes utiles qui ne sont ni nom, groupe, âge, régime, adresse, mail ou téléphone (table, hébergement, navette, réponse, cadeau…) vont dans extra, avec le nom de la colonne comme clé.
- Nombre de personnes (colonne « Nb », « Pers. », « NE », un chiffre seul après le nom, souvent sans en-tête) : c'est le nombre de personnes de la ligne. 2 = un couple : « Maud & Gautier » = deux entrées ; « Brune » avec 2 = Brune + une entrée vide avec plus_one_of ; « hugo & raph & vito » avec 3 = trois entrées. 0 ou vide = une seule entrée, présence à confirmer. Ce chiffre ne finit jamais dans un nom.
- Présence aux moments du mariage (colonne « Statut », « Présence », « RSVP », mots comme « diner », « cocktail », « vin d'honneur », « brunch », « tbc », « pas là », « décline », ou colonnes Oui/Non par moment) : ne mets jamais ces mots dans le nom. Écris la présence dans extra, une clé par moment, sur chaque personne de la ligne, avec les valeurs « Oui » ou « Non ». Les moments du mariage te sont donnés dans la demande : utilise exactement leur nom comme clé quand le moment correspond (« diner » = le moment qui est le dîner, « cocktail » = le cocktail), sinon « Dîner » et « Cocktail ». Un invité « diner » est aussi invité au cocktail et au vin d'honneur qui précèdent le dîner : Oui + Oui ; « cocktail » seul = Cocktail Oui et Dîner Non ; « pas là », « absent », « décline » = Non partout ; « tbc », « à confirmer », « ? » = ne mets pas la clé et marque uncertain avec la note « Présence à confirmer ». Ajoute chaque clé utilisée à extra_columns.
- Lignes surlignées ou colorées (orange, jaune) dans un tableau ou une capture : c'est le plus souvent « à confirmer » ou « à relancer » ; mets la note « Surligné dans la liste » sans inventer de raison. Texte barré = personne retirée de la liste, ignore-la. Capture d'écran ou photo : lis chaque ligne visible, ignore l'interface (menus, filtres, onglets, numéros de ligne).
- Un prénom seul, un surnom ou une initiale (« Jo », « Tiph G », « Clem de martin ») est normal dans une liste entre proches : garde-le tel quel, ne marque pas uncertain et ne complète jamais le nom. Une cellule avec plusieurs prénoms et un seul nom de famille (« Marc et Anne Dubois ») donne le nom aux deux.
- Plusieurs feuilles, onglets ou blocs : chaque bloc peut avoir ses propres colonnes ; lis-les séparément. Les colonnes que tu ne sais pas classer vont dans extra avec leur titre.
- Une adresse répartie sur plusieurs colonnes (rue, code postal, ville) devient une seule adresse.

Ne devine jamais : n'invente ni nom, ni prénom, ni information absente. Omets les champs vides. Marque uncertain (avec une note courte) quand un nom est mal lisible, incomplet ou ambigu.`;

const TOOL = {
  name: "enregistrer_invites",
  description: "Enregistre la liste des invités lue dans les documents.",
  input_schema: {
    type: "object",
    properties: {
      guests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            group: { type: ["string", "null"], description: "Le groupe existant qui correspond (section, côté, feuille), sinon le groupe tel qu'écrit, sinon null" },
            age: { type: ["integer", "null"], description: "Seulement pour les enfants" },
            diet: { type: ["string", "null"], description: "Régime ou allergie : végétarien, sans gluten, halal…" },
            address: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            plus_one_of: { type: ["string", "null"], description: "Pour un +1 sans nom : prénom et nom de la personne qu'il accompagne" },
            uncertain: { type: "boolean", description: "true seulement si le nom est peu lisible ou ambigu" },
            note: { type: ["string", "null"], description: "Pourquoi c'est incertain, en quelques mots" },
            extra: { type: "object", description: "Autres colonnes utiles trouvées (ex. Navette, Table), clé = nom de colonne", additionalProperties: { type: "string" } },
          },
          required: ["first_name", "last_name"],
        },
      },
      extra_columns: { type: "array", items: { type: "string" } },
      columns: {
        type: "array",
        description: "Ce que tu as compris de la structure : une entrée par colonne ou information reconnue (max 8)",
        items: {
          type: "object",
          properties: {
            source: { type: "string", description: "La colonne telle qu'elle apparaît (« Statut », « 3e colonne », « surlignage orange »)" },
            meaning: { type: "string", description: "Ce que Merry en fait, en quelques mots (« Présence au dîner et au cocktail », « Nombre de personnes : 2 = couple »)" },
          },
          required: ["source", "meaning"],
        },
      },
      guide: { type: "string", description: "En une à trois phrases, comment lire ce fichier (colonnes, sens du nombre et du statut) pour que les parties suivantes soient lues de la même façon" },
    },
    required: ["guests", "extra_columns", "columns", "guide"],
  },
};

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_ai" }, { status: 501 });

  // Réservé aux organisateurs connectés, avec un nombre de lectures par jour
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: calls, error: tickError } = await sb.rpc("merry_ai_tick");
  if (tickError) {
    console.error("[merry] merry_ai_tick", tickError.code, tickError.message);
    return Response.json({ error: "tick", code: tickError.code || null }, { status: 403 });
  }
  if (calls > DAILY_LIMIT) return Response.json({ error: "quota" }, { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "too_big" }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // Un fichier par appel : la réponse reste courte et sous la limite de temps de Vercel
  const s = body.source || {};
  const name = String(s.name || "liste").slice(0, 120);
  const where = s.label ? ` (${String(s.label).slice(0, 60)})` : "";
  const content = [];
  if (s.context) {
    content.push({
      type: "text",
      text: `Premières lignes du fichier, pour comprendre les colonnes (elles ont déjà été lues, n'enregistre pas ces personnes) :\n${String(s.context).slice(0, 4000)}`,
    });
  }
  if (s.kind === "text") {
    content.push({ type: "text", text: `Fichier « ${name} »${where} :\n${String(s.content || "").slice(0, MAX_TEXT)}` });
  } else if (s.kind === "image" && /^image\/(png|jpeg|gif|webp)$/.test(s.mime)) {
    content.push({ type: "text", text: `Fichier « ${name} »${where} (photo) :` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mime, data: String(s.content || "") } });
  } else if (s.kind === "pdf") {
    content.push({ type: "text", text: `Fichier « ${name} »${where} (PDF) :` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: String(s.content || "") } });
  } else {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const groups = (body.groups || []).map(String).slice(0, 30);
  const fields = (body.fields || []).map(String).slice(0, 30);
  const events = (body.events || []).map(String).slice(0, 12);
  if (body.guide) {
    content.push({ type: "text", text: `Comment lire ce fichier (établi sur la première partie, applique-le tel quel) : ${String(body.guide).slice(0, 800)}` });
  }
  content.push({
    type: "text",
    text: `Groupes existants : ${groups.join(", ") || "aucun"}. Moments du mariage : ${events.join(", ") || "non précisés"}. Colonnes déjà présentes dans la liste du couple : ${fields.join(", ") || "aucune"}. Enregistre maintenant chaque personne invitée de ce passage.`,
  });

  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content }],
      }),
    });
  let res = await call();
  // Service surchargé : un second essai
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call();
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[merry] import IA", res.status, detail.slice(0, 500));
    return Response.json({ error: "ai_failed", upstream: res.status }, { status: 502 });
  }
  const out = await res.json();
  const used = (out.content || []).find((c) => c.type === "tool_use");
  if (!used) return Response.json({ error: "ai_failed" }, { status: 502 });
  return Response.json({
    guests: used.input.guests || [],
    extraColumns: used.input.extra_columns || [],
    columns: used.input.columns || [],
    guide: used.input.guide || "",
    truncated: out.stop_reason === "max_tokens",
  });
}
