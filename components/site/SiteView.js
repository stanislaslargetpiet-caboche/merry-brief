"use client";

// Le site vu par les invités, dans le modèle, les couleurs et la police choisis.
// Utilisé tel quel par la page publique (/s/[slug]) et par l'éditeur du tableau de bord (/dashboard/site),
// qui passe « edit » : les textes s'écrivent alors sur place (components/site/edit.js).
// Les rubriques suivent l'ordre du couple ; sur ordinateur, certaines se rangent côte à côte
// comme dans la maquette (span du modèle), sur téléphone une rubrique par ligne.

import { hasContent, paletteOf, paletteStyle, fontsOf, fontStyle, sectionsOf, SECTIONS, siteView, templateOf } from "@/lib/site/model";
import { EmptySection } from "./parts";
import { SiteEditProvider, SiteTextProvider } from "./edit";
import Horizon from "./templates/Horizon";
import Terracotta from "./templates/Terracotta";
import Perle from "./templates/Perle";

const IMPL = { horizon: Horizon, terracotta: Terracotta, perle: Perle };

const SIZE = { half: 2, third: 3, wide: 2, narrow: 2 };

// Rubriques voisines de même largeur réunies en lignes (deux ou trois par ligne)
function rows(keys, span = {}) {
  const out = [];
  for (const key of keys) {
    const s = span[key] || "full";
    const prev = out[out.length - 1];
    const fits = prev && prev.span !== "full" && SIZE[s] && prev.keys.length < SIZE[prev.span] && (s === prev.span || (prev.span === "wide" && s === "narrow") || (prev.span === "narrow" && s === "wide"));
    if (fits) prev.keys.push(key);
    else out.push({ span: s, keys: [key] });
  }
  return out;
}

// Rubriques qui ne s'écrivent pas sur la page : la date, les moments (liste d'invités), le formulaire
const NOT_INLINE = new Set(["jour", "programme", "reponse"]);

export default function SiteView({ site, wedding, events, formSlug = null, preview = false, shareUrl = "", edit = null }) {
  const t = templateOf(site?.template);
  const T = IMPL[t.id];
  const v = siteView({ site, wedding, events, formSlug, preview });
  const palette = paletteOf(t.id, site?.palette);
  const fonts = fontsOf(site);
  const shown = sectionsOf(site).filter((s) => !s.hidden && T.sections[s.key]);
  // Pour les invités, une rubrique vide ou sans objet n'apparaît pas
  const keys = shown.map((s) => s.key).filter((k) => preview || (hasContent(k, v) && (!T.visible || T.visible(k, v))));
  const nav = keys.filter((k) => t.nav?.[k]).map((k) => ({ key: k, label: t.nav[k] }));
  const ctx = { v, preview, nav, keys, shareUrl, site, edit: !!edit };

  const render = (key) => {
    if (preview && !hasContent(key, v) && (!edit || NOT_INLINE.has(key))) return <EmptySection key={key} id={key} label={SECTIONS[key].label} edit={!!edit} />;
    const Section = T.sections[key];
    return <Section key={key} ctx={ctx} />;
  };

  const page = (
    // --nl : longueur du plus long prénom, pour réduire les très grands titres quand les prénoms sont longs
    <div className={`s-root st-${t.id}`} style={{ ...paletteStyle(palette.vars), ...fontStyle(fonts), "--nl": Math.max(4, v.p1.length, v.p2.length) }}>
      <div className="s-page">
        <T.Top ctx={ctx} />
        {T.Layout ? (
          <T.Layout ctx={ctx} render={render} />
        ) : (
          rows(keys, t.span).map((r) =>
            r.keys.length > 1 ? (
              <div key={r.keys.join("-")} className={`s-row is-${r.span === "third" ? "third" : r.keys.length === 2 && (t.span?.[r.keys[0]] === "wide" || t.span?.[r.keys[0]] === "narrow") ? "split" : "half"}${t.span?.[r.keys[0]] === "narrow" ? " is-flip" : ""} is-n${r.keys.length}`}>
                {r.keys.map((k) => render(k))}
              </div>
            ) : (
              render(r.keys[0])
            ),
          )
        )}
        <T.Footer ctx={ctx} />
      </div>
    </div>
  );
  const texts = { tpl: t.id, labels: v.content.labels };
  return (
    <SiteTextProvider value={texts}>
      {edit ? <SiteEditProvider value={{ ...edit, content: v.content }}>{page}</SiteEditProvider> : page}
    </SiteTextProvider>
  );
}
