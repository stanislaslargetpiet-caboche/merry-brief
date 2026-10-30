"use client";

// Éditeur du site de mariage (artboards « 9b · Éditeur du site », ordinateur et téléphone) : le site en grand,
// modifiable sur place ; à gauche le modèle, les couleurs, la police et la liste des éléments ; au-dessus,
// l'aperçu ordinateur ou téléphone, le lien et la mise en ligne. Sur téléphone, le site plein écran et un tiroir.
// Un clic sur un texte l'écrit, le carré noir d'une rubrique la déplace, « Réglages » ouvre ses champs
// (dates, listes, photos). Enregistré dans wedding_sites (supabase/site-mariage.sql).

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { shrinkImage } from "@/lib/dash/form";
import { FONT_PAIRS, fontsHref, fontsOf, makeSiteSlug, palettesFor, paletteOf, SECTIONS, sectionsOf, siteUrl, TEMPLATES, templateOf, defaultSite, withDefaults } from "@/lib/site/model";
import { demoSiteContent } from "@/lib/site/demo";
import SiteView from "@/components/site/SiteView";
import { setPath } from "@/components/site/edit";
import { SectionFields, SetupNotice } from "@/components/dash/SiteFields";
import { Icon } from "@/components/dash/icons";
import { PageHeader } from "@/components/dash/ui";
import "../../s/site.css";

function startSite(data, demo) {
  const base = data.site ? { ...data.site } : defaultSite(data);
  if (!data.site && demo) base.content = demoSiteContent(data);
  return { ...base, content: withDefaults(base.content), sections: sectionsOf(base) };
}

const TPL_SAMPLE = (t) => {
  const o = paletteOf(t.id, "origine").vars;
  const f = FONT_PAIRS.find((p) => p.id === t.fonts);
  return {
    background: `linear-gradient(160deg, ${o.bg} 0%, ${o.tint} 100%)`,
    color: o.accent,
    fontFamily: `'${f.display}', serif`,
    boxShadow: `inset 0 -3px 0 ${o.accent2 || o.accent}`,
  };
};

const Grip = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />))}
  </svg>
);

// Les rubriques affichées sur la page, mesurées (en pixels de l'écran) par rapport au cadre du site
function measure(frame, keys) {
  if (!frame) return [];
  const base = frame.getBoundingClientRect();
  return keys
    .map((key) => {
      const el = frame.querySelector(`.s-root [id="${key}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { key, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    })
    .filter(Boolean);
}

// Où lâcher la rubrique : avant ou après la rubrique la plus proche du pointeur
function dropAt(boxes, key, px, py) {
  let best = null;
  for (const b of boxes) {
    if (b.key === key) continue;
    const dx = Math.max(b.x - px, 0, px - (b.x + b.w));
    const dy = Math.max(b.y - py, 0, py - (b.y + b.h));
    const d = dx * dx + dy * dy;
    if (!best || d < best.d) best = { b, d };
  }
  if (!best) return null;
  const { b } = best;
  return { key: b.key, after: py > b.y + b.h / 2, box: b };
}

function Canvas({ site, data, device, edit, onMove, onHide, settingsFor, setSettingsFor, settings }) {
  const scroller = useRef(null);
  const frame = useRef(null);
  const [width, setWidth] = useState(0);
  const [boxes, setBoxes] = useState([]);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  // Téléphone : le site à la largeur de l'écran quand il est plus étroit que 390 px
  const siteWidth = device === "phone" ? (width && width < 390 ? width : 390) : 1280;
  const scale = width ? Math.min(1, (width - (device === "phone" ? 0 : 8)) / siteWidth) : 0;
  const keys = useMemo(() => site.sections.filter((s) => !s.hidden).map((s) => s.key), [site.sections]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth - 2 * (device === "phone" ? 0 : 24)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  // Mesure après chaque rendu du site (contenu, modèle, police) et quand il change de taille
  useEffect(() => {
    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBoxes(measure(frame.current, keys)));
    };
    run();
    const ro = new ResizeObserver(run);
    if (frame.current) ro.observe(frame.current);
    const fonts = document.fonts;
    fonts?.addEventListener?.("loadingdone", run);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fonts?.removeEventListener?.("loadingdone", run);
    };
  }, [site, keys, scale]);

  const pointAt = (e) => {
    const r = frame.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onPointerMove = (e) => {
    if (drag || !frame.current || e.target.closest(".d-se-box, .d-se-pop")) return;
    const [x, y] = pointAt(e);
    const inside = boxes.filter((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).sort((a, b) => a.w * a.h - b.w * b.h);
    setHover(inside[0]?.key || null);
  };

  const startDrag = (key, e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setSettingsFor(null);
    setDrag({ key, target: null });
  };
  const moveDrag = (e) => {
    if (!drag) return;
    const [x, y] = pointAt(e);
    // Près des bords, la page défile toute seule
    const sr = scroller.current.getBoundingClientRect();
    if (e.clientY < sr.top + 60) scroller.current.scrollTop -= 14;
    if (e.clientY > sr.bottom - 60) scroller.current.scrollTop += 14;
    setDrag({ key: drag.key, target: dropAt(boxes, drag.key, x, y), x, y });
  };
  const endDrag = () => {
    if (drag?.target) onMove(drag.key, drag.target.key, drag.target.after);
    setDrag(null);
  };

  // Les liens du site ne partent pas pendant l'édition
  const guard = (e) => {
    if (e.target.closest(".s-ed")) return;
    if (e.target.closest("a")) e.preventDefault();
  };

  const active = drag?.key || settingsFor || hover;
  const box = boxes.find((b) => b.key === active);
  const target = drag?.target;

  return (
    <div ref={scroller} className={`d-se-canvas is-${device}`} onPointerLeave={(e) => e.pointerType === "mouse" && !drag && !settingsFor && setHover(null)}>
      <div className="d-se-frame-wrap" style={{ width: siteWidth * scale || undefined }}>
        <div ref={frame} className="d-se-frame" onPointerMove={onPointerMove} onPointerDown={onPointerMove} onClickCapture={guard}>
          <div className="d-se-scaler" style={{ width: siteWidth, transform: `scale(${scale})`, marginBottom: scale ? `calc(${scale - 1} * var(--se-h, 0px))` : 0 }}>
            <ScaledHeight scale={scale}>
              <SiteView site={site} wedding={data.wedding} events={data.events} formSlug={data.form?.published ? data.form.slug : null} preview shareUrl={siteUrl(site.slug)} edit={edit} />
            </ScaledHeight>
          </div>
          {box ? (
            <div className={`d-se-box${drag ? " is-drag" : ""}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
              <button
                type="button"
                className="d-se-handle"
                aria-label={`Déplacer : ${SECTIONS[box.key]?.label}`}
                title="Maintenir et glisser pour déplacer"
                onPointerDown={(e) => startDrag(box.key, e)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
              >
                <Grip />
              </button>
              {drag ? null : (
                <span className="d-se-tools">
                  <span className="d-se-tag">{SECTIONS[box.key]?.label}</span>
                  <button type="button" className="d-se-tool" aria-expanded={settingsFor === box.key} onClick={() => setSettingsFor(settingsFor === box.key ? null : box.key)}>
                    Réglages
                  </button>
                  <button type="button" className="d-se-tool" onClick={() => onHide(box.key)}>
                    Masquer
                  </button>
                </span>
              )}
            </div>
          ) : null}
          {target ? <div className="d-se-drop" style={{ left: target.box.x, width: target.box.w, top: target.after ? target.box.y + target.box.h + 4 : target.box.y - 6 }} /> : null}
          {settingsFor && box ? (
            <div className="d-se-pop" style={{ top: Math.max(8, box.y + 24) }} role="dialog" aria-label={`Réglages : ${SECTIONS[settingsFor]?.label}`}>
              <div className="d-se-pop-head">
                <strong>{SECTIONS[settingsFor]?.label}</strong>
                <button type="button" className="d-icon-btn is-flat" aria-label="Fermer les réglages" onClick={() => setSettingsFor(null)}>
                  <Icon name="x" size={17} />
                </button>
              </div>
              {settings(settingsFor)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Le site mis à l'échelle garde sa hauteur réelle dans la page (sinon l'espace sous le site reste vide)
function ScaledHeight({ scale, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => el.parentElement?.style.setProperty("--se-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);
  return <div ref={ref}>{children}</div>;
}

export default function SiteMariage() {
  const dash = useDash();
  const data = dash.data;
  const [site, setSite] = useState(() => startSite(data, dash.mode !== "live"));
  const [status, setStatus] = useState(data.site ? "saved" : "new");
  const [device, setDevice] = useState("desktop");
  const [allFonts, setAllFonts] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [settingsFor, setSettingsFor] = useState(null);
  const [phone, setPhone] = useState(false);
  const timer = useRef(null);
  const latest = useRef(site);
  const photoInput = useRef(null);
  const photoPath = useRef(null);

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

  // Téléphone : le site à la largeur de l'écran, réglages dans le tiroir
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
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

  // Ce que le site modifiable sur place peut écrire
  const edit = {
    set: (path, value) => change((s) => ({ content: setPath(s.content, path, value) })),
    setLabel: (key, text) =>
      change((s) => {
        const labels = { ...(s.content.labels || {}) };
        if (text == null) delete labels[key];
        else labels[key] = text;
        return { content: { ...s.content, labels } };
      }),
    pickPhoto: (path) => {
      photoPath.current = path;
      photoInput.current?.click();
    },
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      dash.setToast({ kind: "error", text: "Choisissez une photo (JPG, PNG ou WebP)." });
      return;
    }
    try {
      const blob = await shrinkImage(file);
      const res = await dash.uploadCover(blob);
      if (res.ok) edit.set(photoPath.current, res.url);
      else dash.setToast({ kind: "error", text: "La photo n'a pas pu être envoyée. Réessayez avec une autre image." });
    } catch {
      dash.setToast({ kind: "error", text: "Cette photo n'a pas pu être lue." });
    }
  };

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
  const view = phone ? "phone" : device;

  const toggle = (key) => change((s) => ({ sections: s.sections.map((x) => (x.key === key ? { ...x, hidden: !x.hidden } : x)) }));
  const moveSection = (key, targetKey, after) =>
    change((s) => {
      const moving = s.sections.find((x) => x.key === key);
      const rest = s.sections.filter((x) => x.key !== key);
      const at = rest.findIndex((x) => x.key === targetKey) + (after ? 1 : 0);
      return { sections: [...rest.slice(0, at), moving, ...rest.slice(at)] };
    });

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
  const p1 = site.content.names?.p1 || data.wedding.partner1?.split(" ")[0] || "Léo";
  const p2 = site.content.names?.p2 || data.wedding.partner2?.split(" ")[0] || "Léa";

  const modele = (
    <div className="d-se-tpls">
      {TEMPLATES.map((x) => (
        <button key={x.id} type="button" title={`${x.name} · ${x.style}`} className={`d-se-tpl${x.id === site.template ? " is-on" : ""}`} aria-pressed={x.id === site.template} onClick={() => change({ template: x.id, palette: "origine", fonts: null })}>
          <span className="d-se-tpl-sample" style={TPL_SAMPLE(x)}>
            {p1.charAt(0)} &amp; {p2.charAt(0)}
          </span>
          <span className="d-se-tpl-name">{x.name}</span>
          <span className="d-se-tpl-style">{x.style}</span>
        </button>
      ))}
    </div>
  );
  const couleurs = (
    <>
      <div className="d-se-swatches">
        {palettes.map((p) => (
          <button key={p.id} type="button" className={`d-se-swatch${p.id === palette.id ? " is-on" : ""}`} aria-pressed={p.id === palette.id} aria-label={`Couleurs ${p.name}`} title={p.name} onClick={() => change({ palette: p.id })} style={{ background: `linear-gradient(135deg, ${p.swatch[0]} 0 55%, ${p.swatch[1]} 55% 100%)` }} />
        ))}
      </div>
      <span className="d-se-note">{palette.name}</span>
    </>
  );
  const police = (
    <div className="d-se-fonts">
      {pairs.map((p) => (
        <button key={p.id} type="button" className={`d-se-font${p.id === fonts.id ? " is-on" : ""}`} aria-pressed={p.id === fonts.id} onClick={() => change({ fonts: p.id === t.fonts ? null : p.id })}>
          <span style={{ fontFamily: `'${p.display}', serif` }}>
            {p1} &amp; {p2}
          </span>
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  );
  const elements = (
    <>
      <div className="d-se-checks">
        {site.sections.map((s) => (
          <label key={s.key} className={`d-se-check${s.hidden ? "" : " is-on"}`}>
            <input type="checkbox" checked={!s.hidden} onChange={() => toggle(s.key)} />
            <span className="d-se-box-ic" aria-hidden="true">
              {s.hidden ? null : <Icon name="check" size={12} sw={3} />}
            </span>
            {SECTIONS[s.key].label}
          </label>
        ))}
      </div>
      <span className="d-se-note">Tout est facultatif. Cliquez un texte du site pour le modifier.</span>
    </>
  );
  const blocks = [
    ["modele", "Modèle", `${TEMPLATES.length} modèles`, modele],
    ["couleurs", "Couleurs", "", couleurs],
    [
      "police",
      "Police",
      <button key="all" type="button" className="d-se-more" onClick={() => setAllFonts(!allFonts)}>
        {allFonts ? "Moins" : `Voir les ${FONT_PAIRS.length}`}
      </button>,
      police,
    ],
    ["elements", "Éléments du site", `${shown} sur ${site.sections.length}`, elements],
  ];

  const online = (
    <button type="button" className={`d-se-online${site.published ? "" : " is-off"}`} aria-pressed={!!site.published} title={site.published ? "Mettre le site hors ligne" : "Mettre le site en ligne"} onClick={() => change({ published: !site.published })}>
      <span />
      {site.published ? "En ligne" : "Hors ligne"}
    </button>
  );

  return (
    <div className="d-se">
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          uploadPhoto(file);
        }}
      />
      <aside className="d-se-panel" aria-label="Apparence du site">
        <div className="d-se-panel-head">
          <Link href="/dashboard/invites/site" className="d-se-back">
            <Icon name="prev" size={16} />
            Invités
          </Link>
          <h1 className="d-se-title">Site de mariage.</h1>
        </div>
        <div className="d-se-panel-body">
          {blocks.map(([id, title, sub, body]) => (
            <section key={id} className="d-se-block">
              <h2>
                {title}
                <span>{sub}</span>
              </h2>
              {body}
            </section>
          ))}
        </div>
      </aside>

      <div className="d-se-stage">
        <div className="d-se-bar">
          <Link href="/dashboard/invites/site" className="d-se-iconbtn d-se-phone-only" aria-label="Retour aux invités">
            <Icon name="prev" size={20} />
          </Link>
          <div className="d-fseg d-se-desk-only" role="group" aria-label="Aperçu">
            {[
              ["desktop", "Ordinateur"],
              ["phone", "Téléphone"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`d-fseg-btn is-req${device === id ? " is-on" : ""}`} aria-pressed={device === id} onClick={() => setDevice(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="d-se-url">
            <strong className="d-se-phone-only">Site de mariage</strong>
            <span>{url.replace(/^https?:\/\//, "")}</span>
            <button type="button" className="d-se-copy d-se-desk-only" onClick={copy}>
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
          </div>
          <span className="d-se-status d-se-desk-only" role="status">
            {statusLabel}
          </span>
          {online}
          <button type="button" className="d-se-iconbtn d-se-phone-only" aria-label={copied ? "Lien copié" : "Copier le lien"} onClick={copy}>
            <Icon name={copied ? "check" : "link"} size={18} />
          </button>
          <button type="button" className="d-btn d-btn-primary d-se-desk-only" onClick={openSite}>
            Voir le site
          </button>
        </div>

        <Canvas site={site} data={data} device={view} edit={edit} onMove={moveSection} onHide={toggle} settingsFor={settingsFor} setSettingsFor={setSettingsFor} settings={(k) => <SectionFields k={k} {...fields} />} />

        <div className="d-se-tabs d-se-phone-only" role="tablist" aria-label="Réglages du site">
          {blocks.map(([id, title]) => (
            <button key={id} type="button" role="tab" aria-selected={sheet === id} className={sheet === id ? "is-on" : ""} onClick={() => setSheet(sheet === id ? null : id)}>
              {title === "Éléments du site" ? "Éléments" : title}
            </button>
          ))}
        </div>
        {sheet && phone ? (
          <div className="d-se-sheet" role="dialog" aria-label={blocks.find((b) => b[0] === sheet)[1]}>
            <span className="d-se-sheet-grip" aria-hidden="true" />
            <div className="d-se-sheet-head">
              <strong>{blocks.find((b) => b[0] === sheet)[1]}</strong>
              <button type="button" className="d-se-iconbtn is-soft" aria-label="Fermer" onClick={() => setSheet(null)}>
                <Icon name="x" size={16} sw={2.2} />
              </button>
            </div>
            <div className="d-se-sheet-body">{blocks.find((b) => b[0] === sheet)[3]}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
