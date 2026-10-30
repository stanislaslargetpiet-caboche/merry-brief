"use client";

// Modifier le site directement sur la page (éditeur du tableau de bord, artboards « 9b · Éditeur du site »).
// SiteView fournit deux contextes :
// - les textes du couple (toujours, aussi pour les invités) : les petits titres des modèles remplacés par le couple ;
// - l'édition (seulement dans le tableau de bord) : lire et écrire le contenu, envoyer une photo.
// <L> : un petit titre du modèle (« Notez la date »), remplaçable ; vidé, il revient au texte du modèle.
// <F> : un champ du contenu (content.mot, content.story.text…), affiché seulement s'il est rempli,
//       sauf pendant l'édition où il montre une invite à écrire.

import { createContext, useContext, useLayoutEffect, useRef } from "react";

const TextCtx = createContext({ tpl: "", labels: {} });
const EditCtx = createContext(null);

export const SiteTextProvider = TextCtx.Provider;
export const SiteEditProvider = EditCtx.Provider;
export const useSiteEdit = () => useContext(EditCtx);

// Valeur d'un chemin « story.text », « faq.2.q », « moments.<id>.name »
export function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split(".");
  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let cur = root;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      cur[k] = value;
      return;
    }
    const next = cur[k];
    cur[k] = Array.isArray(next) ? [...next] : next && typeof next === "object" ? { ...next } : /^\d+$/.test(keys[i + 1]) ? [] : {};
    cur = cur[k];
  });
  return root;
}

// Le texte tel qu'il est écrit (innerText suivrait text-transform : « NOTEZ LA DATE »), retours à la ligne compris
function readText(el) {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.nodeValue;
    else if (n.nodeName === "BR") out += "\n";
    else if (n.nodeType === 1) out += `${/^(DIV|P)$/.test(n.nodeName) && out && !out.endsWith("\n") ? "\n" : ""}${readText(n)}`;
  });
  return out;
}

// Texte modifiable sur place : le DOM garde la main pendant la frappe (le curseur ne saute pas)
export function Editable({ as: Tag = "span", value, placeholder, onChange, multiline = false, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && readText(el) !== (value || "")) el.textContent = value || "";
  }, [value]);
  return (
    <Tag
      ref={ref}
      className={`${className} s-ed${value ? "" : " is-empty"}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline || undefined}
      aria-label={placeholder}
      data-ph={placeholder}
      spellCheck
      onInput={(e) => {
        const text = readText(e.currentTarget).replace(/\u00a0/g, " ");
        e.currentTarget.classList.toggle("is-empty", !text.trim());
        onChange(multiline ? text : text.replace(/\n+/g, " "));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") e.currentTarget.blur();
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onBlur={(e) => {
        if (readText(e.currentTarget) !== (value || "")) e.currentTarget.textContent = value || "";
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// Petit titre du modèle, remplaçable par le couple
export function L({ children }) {
  const { tpl, labels } = useContext(TextCtx);
  const edit = useContext(EditCtx);
  if (typeof children !== "string") return children ?? null;
  const key = `${tpl}:${children}`;
  const text = labels?.[key] || children;
  if (!edit) return text;
  return <Editable value={text} placeholder={children} onChange={(t) => edit.setLabel(key, t.trim() && t.trim() !== children ? t : null)} />;
}

// Valeur résolue d'un petit titre du modèle, pour un rendu personnalisé (ex. mise en forme
// typographique autour du texte, comme les mots en italique de Colline) : { text, edit }.
// « text » est ce qu'il faut afficher (le texte résolu, ou tel quel si « children » n'est pas
// une chaîne) ; « edit », non nul seulement en édition sur une chaîne, donne onChange à poser
// sur un <Editable>.
export function useLabel(children) {
  const { tpl, labels } = useContext(TextCtx);
  const edit = useContext(EditCtx);
  if (typeof children !== "string") return { text: children, edit: null };
  const key = `${tpl}:${children}`;
  const text = labels?.[key] || children;
  if (!edit) return { text, edit: null };
  return { text, edit: { onChange: (t) => edit.setLabel(key, t.trim() && t.trim() !== children ? t : null) } };
}

// Champ du contenu : « value » est ce que montre le site (le champ, ou ce qui le remplace quand il est vide :
// le lieu du mariage, le prénom…) ; écrire enregistre le chemin « k » du contenu
export function F({ k, value, as: Tag = "span", className = "", placeholder, multiline }) {
  const edit = useContext(EditCtx);
  if (!edit) return value ? <Tag className={className}>{value}</Tag> : null;
  return <Editable as={Tag} className={className} value={value || ""} placeholder={placeholder || "Écrire ici"} multiline={multiline} onChange={(t) => edit.set(k, t)} />;
}

// Pendant l'édition, un bloc vide reste visible pour qu'on puisse l'écrire
export function useShowEmpty() {
  return !!useContext(EditCtx);
}
