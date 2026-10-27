"use client";

// Réglages du site de mariage (artboards « 9 · Réglages du site », ordinateur et téléphone) :
// les rubriques (ordre, affichage, contenu), l'apparence (modèle, couleurs, police) avec l'aperçu,
// le lien à partager et la mise en ligne. Enregistré dans wedding_sites (supabase/site-mariage.sql).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { defaultSections, defaultSite, FONT_PAIRS, fontsHref, fontsOf, makeSiteSlug, palettesFor, paletteOf, SECTIONS, sectionsOf, siteUrl, TEMPLATES, templateOf, withDefaults } from "@/lib/site/model";
import { demoSiteContent } from "@/lib/site/demo";
import SiteView from "@/components/site/SiteView";
import { HeaderFields, SectionFields, SetupNotice } from "@/components/dash/SiteFields";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";
import "../../s/site.css";

function startSite(data, demo) {
  const base = data.site ? { ...data.site } : defaultSite(data);
  if (!data.site && demo) base.content = demoSiteContent(data);
  return { ...base, content: withDefaults(base.content), sections: sectionsOf(base) };
}

// Aperçu réduit : le site rendu à sa vraie largeur (1280 ou 390 px), mis à l'échelle de la carte
function Preview({ site, data, device }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const width = device === "phone" ? 390 : 1280;
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      setW(box.current?.clientWidth || 0);
      setH(inner.current?.offsetHeight || 0);
    });
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [device]);
  const scale = w ? Math.min(1, (device === "phone" ? Math.min(w, 300) : w) / width) : 0;
  return (
    <div ref={box} className={`d-site-preview is-${device}`} aria-label="Aperçu du site" role="img">
      <div style={{ height: h * scale, width: width * scale, margin: device === "phone" ? "0 auto" : undefined }}>
        <div ref={inner} className="d-site-preview-inner" style={{ width, transform: `scale(${scale})` }}>
          <SiteView site={site} wedding={data.wedding} events={data.events} formSlug={data.form?.published ? data.form.slug : null} preview shareUrl={siteUrl(site.slug)} />
        </div>
      </div>
    </div>
  );
}

const TPL_SAMPLE = (t) => {
  const o = paletteOf(t.id, "origine").vars;
  const f = FONT_PAIRS.find((p) => p.id === t.fonts);
  return { background: o.bg, color: t.id === "embarquement" ? o.onBg : o.accent, fontFamily: `'${f.display}', serif` };
};

export default function SiteMariage() {
  const dash = useDash();
  const data = dash.data;
  const [site, setSite] = useState(() => startSite(data, dash.mode !== "live"));
  const [status, setStatus] = useState(data.site ? "saved" : "new");
  const [open, setOpen] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [tab, setTab] = useState("look");
  const [allFonts, setAllFonts] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const latest = useRef(site);

  const save = useCallback(
    async (next, retry = true) => {
      setStatus("saving");
      const res = await dash.saveSite({ slug: next.slug, published: next.published, template: next.template, palette: next.palette, fonts: next.fonts, sections: next.sections, content: next.content });
      if (res.ok) {
        setStatus("saved");
        return true;
      }
      // Adresse déjà prise par un autre mariage : on en tire une nouvelle
      if (retry && res.error?.code === "23505") {
        const again = { ...latest.current, slug: makeSiteSlug(data.wedding) };
        latest.current = again;
        setSite(again);
        return save(again, false);
      }
      setStatus("error");
      return false;
    },
    [dash, data.wedding],
  );

  // Le site existe en base dès la première visite, pour que le lien marche tout de suite
  useEffect(() => {
    if (!data.site && data.siteSetup !== false) save(latest.current);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toutes les polices proposées, pour les montrer chacune dans sa police
  useEffect(() => {
    const id = "merry-site-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = fontsHref(FONT_PAIRS);
    document.head.appendChild(link);
  }, []);

  const change = (patch) => {
    const next = { ...latest.current, ...(typeof patch === "function" ? patch(latest.current) : patch) };
    latest.current = next;
    setSite(next);
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(latest.current), 700);
  };
  const setContent = (patch) => change((s) => ({ content: { ...s.content, ...patch } }));
  const setPhoto = (key, value) => change((s) => ({ content: { ...s.content, photos: { ...s.content.photos, [key]: value } } }));

  if (dash.mode === "live" && data.siteSetup === false) {
    return (
      <>
        <PageHeader title="Site de mariage." />
        <SetupNotice />
      </>
    );
  }

  const t = templateOf(site.template);
  const palettes = palettesFor(site.template);
  const palette = paletteOf(site.template, site.palette);
  const fonts = fontsOf(site);
  const url = siteUrl(site.slug);
  const shown = site.sections.filter((s) => !s.hidden).length;
  const statusLabel = { new: "", saving: "Enregistrement…", pending: "Modifications en cours…", saved: "Enregistré", error: "Pas enregistré, vérifiez votre connexion" }[status];

  const move = (i, d) =>
    change((s) => {
      const j = i + d;
      if (j < 0 || j >= s.sections.length) return {};
      const next = [...s.sections];
      [next[i], next[j]] = [next[j], next[i]];
      return { sections: next };
    });
  const toggle = (key) => change((s) => ({ sections: s.sections.map((x) => (x.key === key ? { ...x, hidden: !x.hidden } : x)) }));

  // Enregistre d'abord, pour que la page invité montre la dernière version
  const openSite = async () => {
    const win = window.open("", "_blank");
    clearTimeout(timer.current);
    await save(latest.current);
    const target = `/s/${latest.current.slug}`;
    if (win) win.location.href = target;
    else window.location.href = target;
  };
  const copy = async () => {
    clearTimeout(timer.current);
    await save(latest.current);
    try {
      await navigator.clipboard.writeText(siteUrl(latest.current.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copiez le lien :", siteUrl(latest.current.slug));
    }
  };

  const fields = { site, setContent, setPhoto, data, dash };
  const pairs = allFonts ? FONT_PAIRS : [fonts, ...FONT_PAIRS.filter((p) => p.id !== fonts.id)].slice(0, 4);

  const rubriques = (
    <section className={`d-card d-site-rubriques${tab === "sections" ? "" : " is-phone-hidden"}`}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2>Les rubriques</h2>
        <span className="d-small d-muted">
          {shown} affichée{shown > 1 ? "s" : ""} · {site.sections.length - shown} masquée{site.sections.length - shown > 1 ? "s" : ""}
        </span>
      </div>
      <p className="d-small d-muted" style={{ margin: "-8px 0 0", lineHeight: 1.5 }}>
        Les flèches changent l’ordre, l’œil masque une rubrique. Ouvrez une rubrique pour la remplir : l'aperçu se met à jour à chaque modification.
      </p>
      <div className="d-col" style={{ gap: 8 }}>
        <div className={`d-site-row is-fixed${open === "entete" ? " is-open" : ""}`}>
          <div className="d-site-row-head">
            <Icon name="lock" size={15} />
            <span className="d-site-row-text">
              <strong>En-tête</strong>
              <span>Vos noms, la date, le lieu, la photo. Toujours en haut.</span>
            </span>
            <button type="button" className="d-icon-btn is-flat" aria-expanded={open === "entete"} aria-label={open === "entete" ? "Fermer l'en-tête" : "Ouvrir l'en-tête"} onClick={() => setOpen(open === "entete" ? null : "entete")}>
              <Icon name={open === "entete" ? "chevUp" : "chevDown"} size={17} />
            </button>
          </div>
          {open === "entete" ? <HeaderFields {...fields} /> : null}
        </div>
        {site.sections.map((s, i) => {
          const meta = SECTIONS[s.key];
          const isOpen = open === s.key;
          return (
            <div key={s.key} className={`d-site-row${isOpen ? " is-open" : ""}${s.hidden ? " is-off" : ""}`}>
              <div className="d-site-row-head">
                <span className="d-site-row-text">
                  <strong>
                    {meta.label}
                    {s.hidden ? <span className="d-site-badge">Masquée</span> : null}
                  </strong>
                  <span>{meta.hint}</span>
                </span>
                <span className="d-site-row-btns">
                  <button type="button" className="d-icon-btn is-flat" aria-label={`Monter : ${meta.label}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="arrowUp" size={17} />
                  </button>
                  <button type="button" className="d-icon-btn is-flat" aria-label={`Descendre : ${meta.label}`} disabled={i === site.sections.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="arrowDown" size={17} />
                  </button>
                  <button type="button" className="d-icon-btn is-flat" aria-pressed={!s.hidden} aria-label={s.hidden ? `Afficher : ${meta.label}` : `Masquer : ${meta.label}`} onClick={() => toggle(s.key)}>
                    <Icon name={s.hidden ? "eyeOff" : "eye"} size={17} />
                  </button>
                  <button type="button" className="d-icon-btn is-flat" aria-expanded={isOpen} aria-label={isOpen ? `Fermer : ${meta.label}` : `Ouvrir : ${meta.label}`} onClick={() => setOpen(isOpen ? null : s.key)}>
                    <Icon name={isOpen ? "chevUp" : "chevDown"} size={17} />
                  </button>
                </span>
              </div>
              {isOpen ? <SectionFields k={s.key} {...fields} /> : null}
            </div>
          );
        })}
      </div>
      <button type="button" className="d-link" style={{ alignSelf: "flex-start" }} onClick={() => change({ sections: defaultSections(site.template) })}>
        Revenir à l'ordre du modèle {t.name}
      </button>
    </section>
  );

  const share = (
    <section className="d-card d-site-share">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2>Partager</h2>
        <span className={`d-site-status${site.published ? "" : " is-off"}`}>
          <span />
          {site.published ? "En ligne" : "Hors ligne"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label className="d-field" style={{ flex: "1 1 200px" }}>
          <span className="d-field-label">Adresse du site</span>
          <input className="d-input" readOnly value={url} onFocus={(e) => e.target.select()} style={{ background: "var(--d-panel)" }} />
        </label>
        <Btn icon={copied ? "check" : "copy"} onClick={copy}>
          {copied ? "Lien copié" : "Copier le lien"}
        </Btn>
      </div>
      <div className="d-site-online">
        <span className="d-site-row-text">
          <strong>Site en ligne</strong>
          <span>Éteint, le lien affiche « Ce site n’est pas encore ouvert ».</span>
        </span>
        <button type="button" role="switch" aria-checked={!!site.published} aria-label="Site en ligne" className={`d-site-switch${site.published ? " is-on" : ""}`} onClick={() => change({ published: !site.published })}>
          <span />
        </button>
      </div>
      <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Liste et cagnotte : bientôt sur votre site.
      </p>
    </section>
  );

  const look = (
    <section className={`d-card d-site-look${tab === "look" ? "" : " is-phone-hidden"}`}>
      <h2>L’apparence</h2>
      <div className="d-field">
        <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
          Modèle <span className="d-muted" style={{ fontWeight: 400 }}>{t.name}</span>
        </span>
        <div className="d-site-templates">
          {TEMPLATES.map((x) => (
            <button key={x.id} type="button" className={`d-site-tpl${x.id === site.template ? " is-on" : ""}`} aria-pressed={x.id === site.template} onClick={() => change({ template: x.id, palette: "origine", fonts: null })}>
              <span className="d-site-tpl-sample" style={TPL_SAMPLE(x)}>
                S &amp; M
              </span>
              <span className="d-site-tpl-text">
                <strong>{x.name}</strong>
                <span>{x.style}</span>
              </span>
            </button>
          ))}
        </div>
        <span className="d-field-hint">Changer de modèle garde vos rubriques et leur ordre. Les couleurs et la police reviennent à celles du modèle.</span>
      </div>
      <div className="d-field">
        <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
          Couleurs <span className="d-muted" style={{ fontWeight: 400 }}>{palette.name}</span>
        </span>
        <div className="d-filters">
          {palettes.map((p) => (
            <button key={p.id} type="button" className={`d-fswatch${p.id === palette.id ? " is-on" : ""}`} aria-pressed={p.id === palette.id} aria-label={`Couleurs ${p.name}`} title={p.name} onClick={() => change({ palette: p.id })}>
              <span style={{ background: `linear-gradient(135deg, ${p.swatch[0]} 50%, ${p.swatch[1]} 50%)` }} />
            </button>
          ))}
        </div>
        <span className="d-field-hint">Chaque modèle a ses couleurs d’origine, un blanc pur, un fond très clair et trois autres teintes.</span>
      </div>
      <div className="d-field">
        <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
          Police <span className="d-muted" style={{ fontWeight: 400 }}>{fonts.name}</span>
        </span>
        <div className="d-col" style={{ gap: 8 }}>
          {pairs.map((p) => (
            <button key={p.id} type="button" className={`d-site-font${p.id === fonts.id ? " is-on" : ""}`} aria-pressed={p.id === fonts.id} onClick={() => change({ fonts: p.id === t.fonts ? null : p.id })}>
              <span className="d-site-font-sample">
                <span style={{ fontFamily: `'${p.display}', serif` }}>{data.wedding.partner1?.split(" ")[0] || "Léo"}</span>
                <span style={{ fontFamily: `'${p.script}', cursive` }}>et</span>
                <span style={{ fontFamily: `'${p.display}', serif` }}>{data.wedding.partner2?.split(" ")[0] || "Léa"}</span>
              </span>
              <span className="d-site-font-name">
                {p.display}
                <br />
                {p.script} · {p.sans}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="d-link" style={{ alignSelf: "flex-start", minHeight: 44 }} onClick={() => setAllFonts(!allFonts)}>
          {allFonts ? "Moins de polices" : `Voir les ${FONT_PAIRS.length} polices`}
        </button>
      </div>
      <div className="d-field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span className="d-field-label">Aperçu</span>
          <div className="d-fseg" role="group" aria-label="Aperçu">
            {[
              ["desktop", "Ordinateur"],
              ["phone", "Téléphone"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`d-fseg-btn is-req${device === id ? " is-on" : ""}`} aria-pressed={device === id} onClick={() => setDevice(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <Preview site={site} data={data} device={device} />
      </div>
      <Btn kind="ghost" icon="external" onClick={openSite} className="d-btn-block d-desk-only-flex">
        Visualiser le site
      </Btn>
    </section>
  );

  return (
    <>
      <PageHeader
        title="Site de mariage."
        actions={
          <span className="d-site-actions">
            <span className="d-small" role="status" style={{ color: status === "error" ? "var(--d-red-ink)" : "var(--d-muted)" }}>
              {statusLabel}
            </span>
            <span className="d-desk-only-flex">
              <Btn kind="ghost" icon="external" onClick={openSite}>
                Visualiser le site
              </Btn>
            </span>
          </span>
        }
      />
      <p className="d-muted" style={{ margin: "-12px 0 0", maxWidth: 640, lineHeight: 1.5 }}>
        Un lien à donner à vos invités : le programme, le lieu et tout le pratique du week-end. Choisissez un modèle, vos couleurs et votre police, puis remplissez les rubriques.
      </p>

      <div className="d-grid-side d-site-grid">
        <div className="d-site-tabs" role="tablist" aria-label="Réglages du site">
          {[
            ["look", "L’apparence"],
            ["sections", "Les rubriques"],
          ].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {rubriques}
        <div className="d-col d-site-side" style={{ gap: 24 }}>
          {share}
          {look}
        </div>
      </div>

      <div className="d-site-sticky">
        <Btn icon="external" onClick={openSite} className="d-btn-block">
          Visualiser le site
        </Btn>
      </div>
    </>
  );
}
