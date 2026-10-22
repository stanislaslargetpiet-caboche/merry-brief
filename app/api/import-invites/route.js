// Lecture des listes d'invités par l'IA, quel que soit le format : chaque fichier arrive
// découpé en parties (25 lignes de tableau, une page de PDF, une photo).
// Deux modes : avec import_id, la lecture se fait APRÈS la réponse (202) et le résultat est écrit dans
// guest_import_parts, donc elle continue même si l'organisateur quitte la page (voir supabase/imports.sql) ;
// sans import_id, la route répond directement avec le résultat (secours si la table n'existe pas encore).
// Réservée aux organisateurs connectés. Nécessite ANTHROPIC_API_KEY côté serveur
// (Vercel > Settings > Environment Variables) ; sans clé, l'appli lit seulement
// les tableaux (Excel, CSV, Word) et le texte collé, colonne par colonne.

import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isForced, refusesForcedTool, rememberNoForce, withTool } from "@/lib/aiTool";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel refuse les requêtes de plus de 4,5 Mo : l'appli réduit les photos et limite les PDF à 3 Mo.
const MAX_BYTES = 4.4 * 1024 * 1024;
const MAX_TEXT = 60000;
const DAILY_LIMIT = 200; // parties lues par compte et par jour (une liste de 200 lignes = 8 parties)
const MODEL = process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const SYSTEM = `Tu lis des listes d'invités de mariage telles que les couples et leurs familles les tiennent : tableaux Excel plus ou moins rangés, exports CSV, documents Word, PDF, photos de listes écrites à la main, notes de téléphone, mails copiés.

Ton travail : retrouver chaque personne invitée et l'enregistrer avec l'outil, une entrée par personne.

Comment lire :
- L'en-tête peut être absent, sur une autre ligne que la première, ou en anglais. Les colonnes peuvent être dans n'importe quel ordre. Déduis le sens d'une colonne de son contenu (un mail, un téléphone, une adresse, un âge).
- Une ligne peut contenir plusieurs personnes : « M. et Mme Jean Dupont » = Jean Dupont + Mme Dupont (prénom inconnu : first_name vide, uncertain, note « Prénom à compléter ») ; « Jean et Marie Dupont » = deux personnes ; « Pierre Martin + 1 » ou « et sa compagne » = Pierre Martin + une entrée vide avec plus_one_of ; « Famille Leroy (4) » sans les prénoms = 4 entrées avec last_name Leroy, first_name vide, uncertain, note « Famille Leroy : prénoms à compléter » ; « les enfants Léo (8 ans) et Jade » = deux entrées avec leur âge si indiqué.
- Les titres de section (« Côté Marie », « Amis du marié », « Famille de Paul », nom de la feuille) donnent le groupe des personnes qui suivent. Choisis le groupe existant qui correspond quand c'est évident, sinon écris le groupe tel quel.
- Un titre trop général (« AMIS », « FAMILLE », « INVITÉS ») qui ne dit pas de qui sont ces personnes ne donne pas de groupe : mets group à null plutôt que de choisir un groupe existant au hasard.
- Une colonne de codes courts (une à trois lettres : « D », « P », « L », « M », « C ») dont le sens n'est écrit nulle part n'est jamais transformée en groupe par toi : garde la lettre telle quelle dans extra, sous le titre de la colonne. L'organisateur sera interrogé sur ce qu'elles désignent.
- Ignore ce qui n'est pas une personne invitée : titres, totaux, sous-totaux, dates, numéros de table seuls, lignes vides, prestataires.
- Retire les titres (M., Mme, Dr, Me) des prénoms. Mets les noms en casse normale (« DUPONT » → « Dupont »).
- Les colonnes utiles qui ne sont ni nom, groupe, âge, régime, adresse, mail ou téléphone (table, hébergement, navette, réponse, cadeau…) vont dans extra, avec le nom de la colonne comme clé.
- Nombre de personnes (colonne « Nb », « Pers. », « NE », un chiffre seul après le nom, souvent sans en-tête) : c'est le nombre de personnes de la ligne. 2 = un couple : « Maud & Gautier » = deux entrées ; « Brune » avec 2 = Brune + une entrée vide avec plus_one_of ; « hugo & raph & vito » avec 3 = trois entrées. 0 ou vide = une seule entrée, présence à confirmer. Ce chiffre ne finit jamais dans un nom.
- Présence aux moments du mariage (colonne « Statut », « Présence », « RSVP », mots comme « diner », « cocktail », « vin d'honneur », « brunch », « tbc », « pas là », « décline », ou colonnes Oui/Non par moment) : ne mets jamais ces mots dans le nom. Écris la présence dans extra, une clé par moment, sur chaque personne de la ligne, avec exactement l'une de ces quatre valeurs : « Invité » (convié, réponse pas encore donnée : c'est le cas d'une liste d'invités classique, « diner », « oui », une croix), « Non invité » (pas convié à ce moment : « non », ou « cocktail » seul pour le dîner), « Vient » (a confirmé sa présence : seulement si le fichier parle de réponse ou de confirmation, « confirmé », « présent », « RSVP oui »), « Ne vient pas » (a décliné : « pas là », « absent », « décline », « ne vient pas »). Les moments du mariage te sont donnés dans la demande : utilise exactement leur nom comme clé quand le moment correspond (« diner » = le moment qui est le dîner, « cocktail » = le cocktail), sinon « Dîner » et « Cocktail ». Un invité « diner » est aussi invité au cocktail et au vin d'honneur qui précèdent le dîner : Invité + Invité ; « cocktail » seul = Cocktail Invité et Dîner Non invité ; « pas là », « absent », « décline » = Ne vient pas partout ; « tbc », « à confirmer », « ? » = ne mets pas la clé et marque uncertain avec la note « Présence à confirmer ». Dans une colonne Oui/Non, « Oui » = Invité et « Non » = Non invité, sauf si la colonne parle de réponse ou de confirmation (alors Vient et Ne vient pas). Ajoute chaque clé utilisée à extra_columns.
- La première ligne d'un tableau est souvent un en-tête (« Nom | NB | Statut », ou un titre de groupe comme « AMIS LEOP/GOMS | NB | Statut ») : ce n'est pas un invité, ne l'enregistre jamais.
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Message clair pour l'organisateur selon la réponse d'Anthropic
function explain(status, raw) {
  let type = "";
  let message = "";
  try {
    const j = JSON.parse(raw);
    type = j?.error?.type || "";
    message = String(j?.error?.message || "");
  } catch {
    /* corps non JSON */
  }
  const m = message.toLowerCase();
  if (m.includes("credit balance")) return "Le crédit du compte Anthropic est épuisé : rechargez-le sur console.anthropic.com.";
  if (status === 401 || type === "authentication_error") return "La clé Anthropic (ANTHROPIC_API_KEY) est refusée : vérifiez-la dans Vercel > Settings > Environment Variables.";
  if (status === 403 || type === "permission_error") return "La clé Anthropic n'a pas accès à ce modèle : changez MERRY_AI_MODEL dans Vercel.";
  if (status === 404 || type === "not_found_error") return `Modèle introuvable (${MODEL}) : corrigez ou supprimez MERRY_AI_MODEL dans Vercel.`;
  if (status === 429) return "Anthropic limite les lectures pour le moment : réessayez dans une minute.";
  if (status === 529 || status >= 500) return "Le service Anthropic est surchargé : réessayez dans un instant.";
  if (status === 400) return `L'IA a refusé la demande${message ? ` : ${message.slice(0, 160)}` : ""}.`;
  return `L'IA n'a pas pu lire cette partie (code ${status}).`;
}

function fail(text, status) {
  return Object.assign(new Error(text), { status });
}

// Connexion à Supabase avec le jeton de l'organisateur (c'est lui qui est vérifié par les règles d'accès)
function connect(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}

// Un appel à l'IA, avec un second essai si le service est surchargé
async function askAi(payload) {
  const started = Date.now();
  let last = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      if (Date.now() - started > 30000) break;
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1500 : 4000));
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 50000);
    try {
      const res = await fetch(`${API}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      });
      if (res.ok) return await res.json();
      const raw = await res.text().catch(() => "");
      console.error("[merry] import IA", res.status, raw.slice(0, 500));
      last = { status: res.status, raw };
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      console.error("[merry] import IA réseau", e?.name, e?.message);
      last = { status: 0, raw: "" };
    } finally {
      clearTimeout(timer);
    }
  }
  throw fail(last && last.status ? explain(last.status, last.raw) : "L'IA n'a pas répondu à temps : réessayez dans un instant.", last?.status || 504);
}

function buildContent(body) {
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
    return null;
  }
  const groups = (body.groups || []).map(String).slice(0, 30);
  const fields = (body.fields || []).map(String).slice(0, 30);
  const events = (body.events || []).map(String).slice(0, 12);
  if (body.guide) content.push({ type: "text", text: `Comment lire ce fichier (établi sur la première partie, applique-le tel quel) : ${String(body.guide).slice(0, 800)}` });
  content.push({
    type: "text",
    text: `Groupes existants : ${groups.join(", ") || "aucun"}. Moments du mariage : ${events.join(", ") || "non précisés"}. Colonnes déjà présentes dans la liste du couple : ${fields.join(", ") || "aucune"}. Enregistre maintenant chaque personne invitée de ce passage.`,
  });
  return content;
}

// Lit une partie du fichier : { guests, extraColumns, columns, guide, truncated }
async function readPart(body) {
  const content = buildContent(body);
  if (!content) throw fail("Format de partie non reconnu.", 400);
  // MERRY_AI_MODEL_FAST : modèle plus rapide pour le texte et les tableaux (facultatif) ; photos et PDF gardent le modèle principal
  const textOnly = body.source?.kind === "text";
  const model = (textOnly && process.env.MERRY_AI_MODEL_FAST) || MODEL;
  // Appel d'outil forcé ; si le modèle le refuse, on le retient et on repart en « auto » avec une consigne explicite
  let used = null;
  let out = null;
  for (let attempt = 0; attempt < 3 && !used; attempt += 1) {
    try {
      out = await askAi(withTool({ model, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content }] }, TOOL));
    } catch (e) {
      if (e.status === 400 && isForced(model) && refusesForcedTool(e.message)) {
        rememberNoForce(model);
        continue;
      }
      throw e;
    }
    used = (out.content || []).find((c) => c.type === "tool_use") || null;
  }
  if (!used) throw fail("L'IA n'a pas renvoyé de liste exploitable pour cette partie.", 502);
  return {
    guests: used.input.guests || [],
    extraColumns: used.input.extra_columns || [],
    columns: used.input.columns || [],
    guide: used.input.guide || "",
    truncated: out.stop_reason === "max_tokens",
  };
}

// Contrôle de santé : la clé, les tables, et (avec ?ping=1) un vrai petit appel à l'IA
export async function GET(req) {
  const sb = connect(req);
  if (!sb) return Response.json({ error: "auth" }, { status: 401 });
  const out = { key: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL, fastModel: process.env.MERRY_AI_MODEL_FAST || null };
  const probe = await sb.from("guest_imports").select("id").limit(1);
  out.background = probe.error ? "missing" : "ok";
  if (new URL(req.url).searchParams.get("ping")) {
    const tick = await sb.rpc("merry_ai_tick");
    out.tick = tick.error ? `error:${tick.error.code || tick.error.message}` : "ok";
    if (!out.key) out.ai = "no_key";
    else {
      try {
        await askAi({ model: MODEL, max_tokens: 8, messages: [{ role: "user", content: "Réponds uniquement : ok" }] });
        out.ai = "ok";
      } catch (e) {
        out.ai = e.message;
      }
    }
  }
  return Response.json(out);
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_ai" }, { status: 501 });

  // Réservé aux organisateurs connectés, avec un nombre de lectures par jour
  const sb = connect(req);
  if (!sb) return Response.json({ error: "auth" }, { status: 401 });
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
  if (!buildContent(body)) return Response.json({ error: "bad_request" }, { status: 400 });

  const importId = typeof body.import_id === "string" && UUID.test(body.import_id) ? body.import_id : null;

  // Réponse directe (sans arrière-plan)
  if (!importId) {
    try {
      return Response.json(await readPart(body));
    } catch (e) {
      return Response.json({ error: "ai_failed", message: e.message, upstream: e.status || null }, { status: 502 });
    }
  }

  // Arrière-plan : on enregistre le morceau, on répond tout de suite, la lecture continue après la réponse
  const idx = Number.isInteger(body.idx) && body.idx >= 0 && body.idx < 200 ? body.idx : 0;
  const { data: job, error: jobError } = await sb.from("guest_imports").select("wedding_id").eq("id", importId).maybeSingle();
  if (jobError || !job) return Response.json({ error: "import_missing" }, { status: 404 });
  const now = () => new Date().toISOString();
  const { error: partError } = await sb
    .from("guest_import_parts")
    .upsert({ import_id: importId, idx, wedding_id: job.wedding_id, status: "running", result: null, error: null, updated_at: now() }, { onConflict: "import_id,idx" });
  if (partError) {
    console.error("[merry] guest_import_parts", partError.code, partError.message);
    return Response.json({ error: "imports_table" }, { status: 500 });
  }
  after(async () => {
    let patch;
    try {
      patch = { status: "done", result: await readPart(body), error: null };
    } catch (e) {
      patch = { status: "failed", result: null, error: String(e?.message || e).slice(0, 300) };
    }
    const { error } = await sb.from("guest_import_parts").update({ ...patch, updated_at: now() }).eq("import_id", importId).eq("idx", idx);
    if (error) console.error("[merry] écriture du résultat", error.code, error.message);
  });
  return Response.json({ queued: true, idx }, { status: 202 });
}
