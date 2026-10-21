// Formulaire invités : questions proposées, thèmes, adresse du lien.
// Partagé entre les réglages (tableau de bord) et la page publique /f/[slug].

import { normalize } from "./format";

// Toujours demandés, ne se retirent pas
export const LOCKED_FIELDS = [
  { key: "prenom", label: "Prénom" },
  { key: "nom", label: "Nom" },
  { key: "mail", label: "Mail" },
];

// Notre présélection : mode off (non demandé), opt (facultatif), req (obligatoire)
export const PRESET_FIELDS = [
  { key: "presence", label: "Présence par moment", hint: "L’invité répond oui ou non à chaque moment choisi ci-dessous", mode: "req" },
  { key: "adresse", label: "Adresse postale", hint: "Pour envoyer les faire-part", mode: "req" },
  { key: "tel", label: "Téléphone", hint: "Utile le jour J pour les navettes", mode: "opt" },
  { key: "regime", label: "Régime et allergies", hint: "Végétarien, sans gluten, halal, allergies", mode: "opt" },
  { key: "plusun", label: "Accompagnant", hint: "Mêmes informations que l’invité pour la personne qui vient avec lui", mode: "opt" },
  { key: "enfants", label: "Enfants", hint: "Nombre et âge, pour le menu enfant", mode: "off" },
  { key: "hebergement", label: "Hébergement", hint: "Besoin d’une chambre à proximité", mode: "off" },
  { key: "mot", label: "Un petit mot pour les mariés ?", hint: "Texte libre", mode: "opt" },
];

export const CUSTOM_TYPES = [
  { id: "text", label: "Texte court" },
  { id: "choice", label: "Choix dans une liste" },
  { id: "yesno", label: "Oui ou non" },
];
export const CUSTOM_MAX = 5;
export const MESSAGE_MAX = 300;

export const DIETS = ["Aucun", "Végétarien", "Sans gluten", "Halal", "Autre"];

// Thèmes doux de la page invité (contrastes texte et bouton vérifiés : 4,5:1 au moins)
export const FORM_THEMES = [
  { id: "sauge", name: "Sauge", bg: "#eef1e8", deep: "#c9d3bd", accent: "#4f6146" },
  { id: "jaune", name: "Jaune pâle", bg: "#fbf6e0", deep: "#efe3a8", accent: "#76611c" },
  { id: "perle", name: "Gris perle", bg: "#f4f4f1", deep: "#dcdcd6", accent: "#3f3f3b" },
  { id: "rose", name: "Rose poudré", bg: "#f8ece8", deep: "#ecc9be", accent: "#8a4a3a" },
  { id: "brume", name: "Bleu brume", bg: "#ebf0f4", deep: "#c7d4df", accent: "#3e5a72" },
];

export function formTheme(id) {
  return FORM_THEMES.find((t) => t.id === id) || FORM_THEMES[0];
}

const PRIVATE_EVENT = /civil|mairie|veille/;

// Adresse lisible et difficile à deviner : « stanislas-et-margue-k7q2 »
export function makeSlug(wedding) {
  const names = [wedding?.partner1, wedding?.partner2].filter(Boolean).map((n) => normalize(n).replace(/[^a-z0-9]+/g, "-")).filter(Boolean);
  const base = (names.join("-et-") || "mariage").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}-${suffix}`;
}

export const DEFAULT_MESSAGE = "Nous avons hâte de fêter ce jour avec vous. Prenez deux minutes pour répondre ci-dessous, cela nous aide beaucoup pour l’organisation.";

// Formulaire de départ : notre présélection, les moments ouverts à tous, le thème sauge
export function defaultForm(data) {
  return {
    slug: makeSlug(data.wedding),
    published: true,
    fields: PRESET_FIELDS.map(({ key, label, mode }) => ({ key, label, mode })),
    custom: [],
    event_ids: data.events.filter((e) => !PRIVATE_EVENT.test(normalize(e.name))).map((e) => e.id),
    message: DEFAULT_MESSAGE,
    theme: "sauge",
    cover_url: null,
    deadline: null,
  };
}

// Complète un formulaire enregistré avec les questions ajoutées depuis (ordre de la présélection)
export function withPresets(form) {
  const saved = new Map((form.fields || []).map((f) => [f.key, f]));
  return {
    ...form,
    fields: PRESET_FIELDS.map((p) => ({ key: p.key, label: saved.get(p.key)?.label || p.label, mode: saved.get(p.key)?.mode || p.mode })),
    custom: Array.isArray(form.custom) ? form.custom : [],
    event_ids: Array.isArray(form.event_ids) ? form.event_ids : [],
  };
}

export function fieldMode(form, key) {
  return (form.fields || []).find((f) => f.key === key)?.mode || "off";
}

export function fieldLabel(form, key) {
  return (form.fields || []).find((f) => f.key === key)?.label || PRESET_FIELDS.find((p) => p.key === key)?.label || key;
}

export function formUrl(slug) {
  if (typeof window === "undefined") return `/f/${slug}`;
  return `${window.location.origin}/f/${slug}`;
}

// Réduit une photo à 1 800 px de large en JPEG avant l'envoi
export async function shrinkImage(file, max = 1800) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}
