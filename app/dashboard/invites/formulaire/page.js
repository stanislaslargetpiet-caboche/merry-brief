"use client";

// Formulaire invités (artboards 2f, 10d, 10e sur ordinateur ; 2t, 2t1, 2t2 sur téléphone) :
// la liste des questions posées, une fenêtre pour chacune, l'aperçu invité et l'apparence sur ordinateur, Partager sur téléphone.

import { useCallback, useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { longDate } from "@/lib/dash/format";
import { CUSTOM_MAX, CUSTOM_TYPES, FORM_THEMES, MESSAGE_MAX, TITLE_MAX, PRESET_FIELDS, defaultForm, formTheme, formUrl, makeSlug, shrinkImage, withPresets } from "@/lib/dash/form";
import { Icon } from "@/components/dash/icons";
import { Btn, Modal, BusyDots } from "@/components/dash/ui";
import InvitesHeader from "@/components/dash/InvitesTabs";

const PILLS = { presence: ["Oui", "Non"], plusun: ["Oui", "Non"], regime: ["Aucun", "Végétarien", "Sans gluten"], hebergement: ["Oui", "Non"] };
const ANSWER_TYPES = [
  { id: "text", label: "Un texte" },
  { id: "yesno", label: "Oui ou non" },
  { id: "choice", label: "Un choix" },
];

function ReqTag({ req, children }) {
  return (
    <span className="d-fm-tags">
      <span className={`d-fm-tag is-${req === "always" ? "always" : req ? "req" : "opt"}`}>{req === "always" ? "Toujours demandés" : req ? "Obligatoire" : "Facultatif"}</span>
      {children ? <span>{children}</span> : null}
    </span>
  );
}

export default function FormulaireInvites() {
  const dash = useDash();
  const data = dash.data;
  const [form, setForm] = useState(() => withPresets(data.form || defaultForm(data)));
  const [status, setStatus] = useState(data.form ? "saved" : "new");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [newOptions, setNewOptions] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Fenêtre ouverte : { kind: "edit", row, label, req, presence_mode, event_ids }, { kind: "add" } ou { kind: "look" }
  const [sheet, setSheet] = useState(null);
  const timer = useRef(null);
  const latest = useRef(form);
  const fileInput = useRef(null);

  const save = useCallback(
    async (next, retry = true) => {
      setStatus("saving");
      const res = await dash.saveForm(next);
      if (res.ok) {
        setStatus("saved");
        return true;
      }
      // Adresse déjà prise par un autre mariage : on en tire une nouvelle
      if (retry && res.error?.code === "23505") {
        const again = { ...latest.current, slug: makeSlug(data.wedding) };
        latest.current = again;
        setForm(again);
        return save(again, false);
      }
      setStatus("error");
      return false;
    },
    [dash, data.wedding],
  );

  // Le formulaire existe en base dès la première visite, pour que le lien marche tout de suite
  useEffect(() => {
    if (!data.form && data.formSetup !== false) save(latest.current);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (patch) => {
    const next = { ...latest.current, ...(typeof patch === "function" ? patch(latest.current) : patch) };
    latest.current = next;
    setForm(next);
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(latest.current), 700);
  };

  if (dash.mode === "live" && data.formSetup === false) {
    return (
      <>
        <InvitesHeader tab="formulaire" />
        <section className="d-card" style={{ maxWidth: 640 }}>
          <h2>Encore une étape côté Supabase</h2>
          <p className="d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Le formulaire a besoin de sa table. Dans Supabase, ouvrez SQL Editor, collez le contenu de <code>supabase/formulaire.sql</code> et lancez-le, puis rechargez cette page.
          </p>
        </section>
      </>
    );
  }

  const theme = formTheme(form.theme);
  const setField = (key, patch) => change((f) => ({ fields: f.fields.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
  const setCustom = (id, patch) => change((f) => ({ custom: f.custom.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const events = data.events;
  const inForm = events.filter((e) => form.event_ids.includes(e.id));
  const url = formUrl(form.slug);
  const coupleName = [data.wedding.partner1, data.wedding.partner2].filter(Boolean).join(" & ");
  const pageTitle = (form.title || "").trim() || coupleName;
  const coverPos = Number.isFinite(Number(form.cover_position)) ? Number(form.cover_position) : 50;
  const modeOf = (key) => form.fields.find((f) => f.key === key)?.mode || "off";
  const labelOf = (key) => form.fields.find((f) => f.key === key)?.label || key;
  const replies = data.form?.submissions || 0;

  // Même ordre que la page invité
  const previewItems = [
    { id: "ident", label: "Prénom, nom et mail", req: true },
    modeOf("tel") !== "off" ? { id: "tel", label: labelOf("tel"), req: modeOf("tel") === "req" } : null,
    modeOf("adresse") !== "off" ? { id: "adresse", label: labelOf("adresse"), req: modeOf("adresse") === "req" } : null,
    ...(modeOf("presence") === "off"
      ? []
      : form.presence_mode === "global"
        ? [{ id: "presence", label: "Serez-vous des nôtres ?", req: modeOf("presence") === "req", pills: ["Oui", "Non"] }]
        : inForm.map((e) => ({ id: `ev-${e.id}`, label: e.name, req: modeOf("presence") === "req", pills: ["Oui", "Non"] }))),
    modeOf("plusun") !== "off" ? { id: "plusun", label: "Venez-vous accompagné(e) ?", req: modeOf("plusun") === "req", pills: ["Oui", "Non"] } : null,
    modeOf("regime") !== "off" ? { id: "regime", label: labelOf("regime"), req: modeOf("regime") === "req", pills: PILLS.regime } : null,
    modeOf("enfants") !== "off" ? { id: "enfants", label: labelOf("enfants"), req: modeOf("enfants") === "req" } : null,
    modeOf("hebergement") !== "off" ? { id: "hebergement", label: labelOf("hebergement"), req: modeOf("hebergement") === "req", pills: ["Oui", "Non"] } : null,
    ...form.custom.map((c) => ({ id: c.id, label: c.label, req: !!c.req, pills: c.type === "yesno" ? ["Oui", "Non"] : c.type === "choice" ? (c.options || []).slice(0, 3) : null })),
    modeOf("mot") !== "off" ? { id: "mot", label: labelOf("mot"), req: modeOf("mot") === "req", tall: true } : null,
  ].filter(Boolean);

  // Seulement les questions posées ; les autres reviennent par « Ajouter une question »
  const momentsText = (mode, ids) => (mode === "global" ? "une seule question" : events.filter((e) => ids.includes(e.id)).map((e) => e.name.toLowerCase()).join(", ") || "aucun moment");
  const presetRow = (f) => ({
    id: f.key,
    key: f.key,
    label: f.label,
    req: f.mode === "req",
    pills: PILLS[f.key] || null,
    tall: f.key === "mot",
    detail: f.key === "presence" ? momentsText(form.presence_mode, form.event_ids) : null,
  });
  const shown = form.fields.filter((f) => f.mode !== "off");
  const rows = [
    ...shown.filter((f) => f.key !== "mot").map(presetRow),
    ...form.custom.map((c) => ({
      id: c.id,
      customId: c.id,
      label: c.label,
      req: !!c.req,
      pills: c.type === "yesno" ? ["Oui", "Non"] : c.type === "choice" ? (c.options || []).slice(0, 4) : null,
      detail: CUSTOM_TYPES.find((t) => t.id === c.type)?.label.toLowerCase(),
    })),
    ...shown.filter((f) => f.key === "mot").map(presetRow),
  ];
  const suggestions = PRESET_FIELDS.filter((p) => modeOf(p.key) === "off");

  const openEdit = (row) => setSheet({ kind: "edit", row, label: row.label, req: row.req, presence_mode: form.presence_mode, event_ids: form.event_ids });
  const saveSheet = () => {
    const label = sheet.label.trim().slice(0, 120) || sheet.row.label;
    if (sheet.row.customId) setCustom(sheet.row.customId, { label, req: sheet.req });
    else {
      setField(sheet.row.key, { label, mode: sheet.req ? "req" : "opt" });
      if (sheet.row.key === "presence") change({ presence_mode: sheet.presence_mode, event_ids: sheet.event_ids });
    }
    setSheet(null);
  };
  const removeSheet = () => {
    if (sheet.row.customId) change((f) => ({ custom: f.custom.filter((x) => x.id !== sheet.row.customId) }));
    else setField(sheet.row.key, { mode: "off" });
    setSheet(null);
  };
  // Les moments restent dans l'ordre du mariage
  const toggleMoment = (id) =>
    setSheet((s) => ({ ...s, event_ids: s.event_ids.includes(id) ? s.event_ids.filter((x) => x !== id) : events.map((e) => e.id).filter((x) => x === id || s.event_ids.includes(x)) }));

  async function addCustom() {
    const label = newLabel.trim() || "Nouvelle question";
    const options = newType === "choice" ? newOptions.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 12) : [];
    const existing = data.fields.find((x) => x.name.trim().toLowerCase() === label.trim().toLowerCase());
    let id = existing?.id || `q${Date.now().toString(36)}`;
    if (!existing) {
      // La question devient aussi une colonne « invités » de la liste
      const [col] = await dash.insert("guest_fields", { name: label.slice(0, 120), position: data.fields.length, source: "invites", kind: newType === "text" ? "text" : "choice", options: newType === "yesno" ? ["Oui", "Non"] : options });
      id = col.id;
    } else if (existing.source !== "invites") dash.update("guest_fields", existing.id, { source: "invites" });
    change((f) => ({ custom: [...f.custom, { id, label: label.slice(0, 120), type: newType, options, req: false }] }));
    setNewLabel("");
    setNewOptions("");
    setNewType("text");
    setSheet(null);
  }

  async function copy() {
    clearTimeout(timer.current);
    await save(latest.current);
    try {
      await navigator.clipboard.writeText(formUrl(latest.current.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copiez le lien :", formUrl(latest.current.slug));
    }
  }

  // Le menu de partage du téléphone (WhatsApp, Messages…) ; à défaut, le lien est copié
  async function share() {
    clearTimeout(timer.current);
    await save(latest.current);
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: pageTitle, text: "Dites-nous si vous serez des nôtres :", url: formUrl(latest.current.slug) });
    } catch {
      // Partage annulé
    }
  }

  // Enregistre d'abord, pour que la page invité montre la dernière version
  async function openGuestPage() {
    const win = window.open("", "_blank");
    clearTimeout(timer.current);
    await save(latest.current);
    const target = `/f/${latest.current.slug}`;
    if (win) win.location.href = target;
    else window.location.href = target;
  }

  async function pickCover(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      dash.setToast({ kind: "error", text: "Choisissez une photo (JPG, PNG ou WebP)." });
      return;
    }
    setUploading(true);
    try {
      const blob = await shrinkImage(file);
      const res = await dash.uploadCover(blob);
      if (res.ok) change({ cover_url: res.url });
      else dash.setToast({ kind: "error", text: "La photo n'a pas pu être envoyée. Réessayez avec une autre image." });
    } catch {
      dash.setToast({ kind: "error", text: "Cette photo n'a pas pu être lue." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <InvitesHeader
        tab="formulaire"
        actions={
          <span className="d-desk-only-flex" style={{ gap: 10, alignItems: "center" }}>
            {status === "error" ? (
              <span className="d-small" role="status" style={{ color: "var(--d-red-ink)" }}>
                Pas enregistré, vérifiez votre connexion
              </span>
            ) : null}
            <Btn kind="ghost" onClick={openGuestPage}>
              Voir comme un invité
            </Btn>
            <Btn icon={copied ? "check" : "copy"} onClick={copy}>
              {copied ? "Lien copié" : "Copier le lien du formulaire"}
            </Btn>
          </span>
        }
      />

      <div className="d-fm">
        <div className="d-fm-main">
          <div className="d-fm-status">
            <span>
              <span className="d-fm-dot" aria-hidden="true" />
              <strong>En ligne</strong>
              {replies ? ` · ${replies} réponse${replies > 1 ? "s" : ""}` : ""}
            </span>
            <button type="button" className="d-link d-mob-only-inline" onClick={openGuestPage}>
              Voir comme un invité
            </button>
          </div>

          <h2 className="d-fm-h d-desk-only">Les questions</h2>
          <section className="d-fm-list" aria-label="Les questions du formulaire">
            <div className="d-fm-row is-locked">
              <Icon name="lock" size={16} />
              <span className="d-fm-text">
                <strong>Prénom, nom et mail</strong>
                <ReqTag req="always" />
              </span>
            </div>
            {rows.map((r) => (
              <button key={r.id} type="button" className="d-fm-row" onClick={() => openEdit(r)}>
                <span className="d-fm-text">
                  <strong>{r.label}</strong>
                  <ReqTag req={r.req}>{r.detail}</ReqTag>
                </span>
                <span className="d-fm-edit d-desk-only">Modifier</span>
                <Icon name="chev" size={16} sw={2.2} />
              </button>
            ))}
            <button type="button" className="d-fm-row is-add" onClick={() => setSheet({ kind: "add" })}>
              <span className="d-fm-plus">
                <Icon name="plus" size={13} sw={2.8} />
              </span>
              Ajouter une question
            </button>
          </section>
        </div>

        <aside className="d-fm-side d-desk-only">
          <h2 className="d-fm-h">Ce que voient vos invités</h2>
          <div className="d-fpreview" style={{ background: theme.bg }} aria-hidden="true">
            <div className="d-fpreview-cover" style={{ background: form.cover_url ? `center ${coverPos}% / cover no-repeat url("${form.cover_url}")` : theme.deep }} />
            <div className="d-fpreview-body">
              <span style={{ color: theme.accent }}>Save the date</span>
              <strong>{pageTitle}</strong>
              <em>{[data.wedding.wedding_date ? longDate(data.wedding.wedding_date) : null, data.wedding.venue].filter(Boolean).join(" · ")}</em>
              {form.message ? <p>{form.message}</p> : null}
              {previewItems.map((f) => (
                <div key={f.id} className="d-fpreview-line">
                  <small>
                    {f.label}
                    {f.req ? " *" : ""}
                  </small>
                  {f.pills ? (
                    <span className="d-fpreview-pills">
                      {f.pills.map((x) => (
                        <u key={x}>{x}</u>
                      ))}
                    </span>
                  ) : (
                    <i style={f.tall ? { height: 40 } : undefined} />
                  )}
                </div>
              ))}
              <b style={{ background: theme.accent }} />
            </div>
          </div>
          <Btn kind="strong" className="d-btn-block" onClick={() => setSheet({ kind: "look" })}>
            Modifier l'apparence
          </Btn>
        </aside>

        <div className="d-fm-share d-mob-only">
          <Btn icon={copied ? "check" : "send"} className="d-btn-block" onClick={share}>
            {copied ? "Lien copié" : "Partager à mes invités"}
          </Btn>
          <span>
            {url.replace(/^https?:\/\//, "")} ·{" "}
            <button type="button" className="d-link" onClick={copy}>
              Copier
            </button>
          </span>
        </div>
      </div>

      {sheet?.kind === "edit" ? (
        <Modal
          title="Modifier la question"
          onClose={() => setSheet(null)}
          footer={
            <div className="d-fm-foot">
              <button type="button" className="d-fm-remove" onClick={removeSheet}>
                Retirer du formulaire
              </button>
              <span className="d-spacer" />
              <Btn kind="ghost" className="d-desk-only" onClick={() => setSheet(null)}>
                Annuler
              </Btn>
              <Btn onClick={saveSheet}>Enregistrer</Btn>
            </div>
          }
        >
          <label className="d-field">
            <span className="d-field-label">La question posée</span>
            <input className="d-input" value={sheet.label} maxLength={120} onChange={(e) => setSheet({ ...sheet, label: e.target.value })} />
          </label>
          <button type="button" className="d-fm-switch-row" role="switch" aria-checked={sheet.req} onClick={() => setSheet({ ...sheet, req: !sheet.req })}>
            <strong>Réponse obligatoire</strong>
            <span className={`d-fm-switch${sheet.req ? " is-on" : ""}`} aria-hidden="true" />
          </button>
          {sheet.row.key === "presence" ? (
            <div className="d-field">
              <span className="d-field-label">Vos invités répondent</span>
              <div className="d-fm-seg is-2" role="radiogroup" aria-label="Vos invités répondent">
                {[
                  { id: "global", label: "Une fois pour tout le mariage" },
                  { id: "moments", label: "Moment par moment" },
                ].map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={sheet.presence_mode === m.id} className={sheet.presence_mode === m.id ? "is-on" : ""} onClick={() => setSheet({ ...sheet, presence_mode: m.id })}>
                    {m.label}
                  </button>
                ))}
              </div>
              {sheet.presence_mode === "moments" ? (
                <div className="d-filters">
                  {events.map((e) => {
                    const on = sheet.event_ids.includes(e.id);
                    return (
                      <button key={e.id} type="button" className={`d-pill${on ? " is-on" : ""}`} style={on ? { background: "var(--d-limetint)" } : undefined} aria-pressed={on} onClick={() => toggleMoment(e.id)}>
                        <Icon name={on ? "check" : "plus"} size={13} sw={on ? 2.4 : 2} />
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="d-field">
            <span className="d-field-label">Ce que voit l'invité</span>
            <div className="d-fm-guest" style={{ background: theme.bg }} aria-hidden="true">
              {(sheet.row.key === "presence"
                ? sheet.presence_mode === "global"
                  ? [{ id: "g", label: "Serez-vous des nôtres ?" }]
                  : events.filter((e) => sheet.event_ids.includes(e.id)).map((e) => ({ id: e.id, label: e.name }))
                : [{ id: "q", label: sheet.label.trim() || sheet.row.label }]
              ).map((q) => (
                <div key={q.id} className="d-fm-guest-q">
                  <strong>
                    {q.label}
                    {sheet.req ? " *" : ""}
                  </strong>
                  {sheet.row.pills ? (
                    <span>
                      {sheet.row.pills.map((x, i) => (
                        <u key={x} style={i === 0 ? { background: theme.accent, color: "#ffffff" } : undefined}>
                          {x}
                        </u>
                      ))}
                    </span>
                  ) : (
                    <i style={sheet.row.tall ? { height: 56 } : undefined} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {sheet?.kind === "add" ? (
        <Modal
          title="Ajouter une question"
          onClose={() => setSheet(null)}
          footer={
            form.custom.length < CUSTOM_MAX ? (
              <Btn className="d-btn-block" onClick={addCustom}>
                Ajouter au formulaire
              </Btn>
            ) : null
          }
        >
          {suggestions.length ? (
            <div className="d-field">
              <span className="d-field-label">En un geste</span>
              <div className="d-filters">
                {suggestions.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="d-pill"
                    onClick={() => {
                      setField(p.key, { mode: p.mode === "off" ? "opt" : p.mode });
                      setSheet(null);
                    }}
                  >
                    <Icon name="plus" size={13} sw={2.4} />
                    {labelOf(p.key)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {form.custom.length < CUSTOM_MAX ? (
            <>
              {suggestions.length ? <div className="d-fm-or">ou votre question</div> : null}
              <label className="d-field">
                <span className="d-field-label">La question posée</span>
                <input className="d-input" value={newLabel} maxLength={120} placeholder="Ex. : Votre chanson pour la soirée" onChange={(e) => setNewLabel(e.target.value)} />
              </label>
              <div className="d-field">
                <span className="d-field-label">L'invité répond par</span>
                <div className="d-fm-seg" role="radiogroup" aria-label="L'invité répond par">
                  {ANSWER_TYPES.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={newType === t.id} className={newType === t.id ? "is-on" : ""} onClick={() => setNewType(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {newType === "choice" ? (
                <label className="d-field">
                  <span className="d-field-label">Les choix proposés</span>
                  <input className="d-input" value={newOptions} placeholder="Séparés par des virgules : Bus, Voiture, Train" onChange={(e) => setNewOptions(e.target.value)} />
                </label>
              ) : null}
            </>
          ) : null}
        </Modal>
      ) : null}

      {sheet?.kind === "look" ? (
        <Modal
          title="L'apparence du formulaire"
          onClose={() => setSheet(null)}
          footer={
            <>
              <span className="d-spacer" />
              <Btn onClick={() => setSheet(null)}>Terminé</Btn>
            </>
          }
        >
          <label className="d-field">
            <span className="d-field-label">Titre de la page</span>
            <input className="d-input" value={form.title || ""} maxLength={TITLE_MAX} placeholder={coupleName} onChange={(e) => change({ title: e.target.value.slice(0, TITLE_MAX) })} />
          </label>
          <div className="d-field">
            <span className="d-field-label">Photo d'en-tête</span>
            <div className="d-fm-photo">
              <span className="d-fm-thumb" style={form.cover_url ? { background: `center ${coverPos}% / cover no-repeat url("${form.cover_url}")` } : { background: theme.deep }} />
              <Btn kind="ghost" small onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <BusyDots /> : form.cover_url ? "Changer la photo" : "Choisir une photo"}
              </Btn>
              {form.cover_url ? (
                <button type="button" className="d-fm-remove" onClick={() => change({ cover_url: null, cover_position: 50 })}>
                  Retirer
                </button>
              ) : null}
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickCover} />
            {form.cover_url ? (
              <span className="d-fcrop-row">
                <span className="d-small d-muted">Haut</span>
                <input type="range" min="0" max="100" step="1" value={coverPos} aria-label="Cadrage vertical de la photo" onChange={(e) => change({ cover_position: Number(e.target.value) })} />
                <span className="d-small d-muted">Bas</span>
              </span>
            ) : null}
          </div>
          <label className="d-field">
            <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
              Votre petit mot
              {form.message ? (
                <button type="button" className="d-icon-btn" aria-label="Effacer le petit mot" onClick={(e) => { e.preventDefault(); change({ message: "" }); }}>
                  <Icon name="x" size={14} sw={2.2} />
                </button>
              ) : null}
            </span>
            <textarea className="d-textarea" rows={3} maxLength={MESSAGE_MAX} value={form.message || ""} onChange={(e) => change({ message: e.target.value.slice(0, MESSAGE_MAX) })} />
          </label>
          <div className="d-fm-pair">
            <label className="d-field">
              <span className="d-field-label">Répondre avant le</span>
              <input className="d-input" type="date" value={form.deadline || ""} onChange={(e) => change({ deadline: e.target.value || null })} />
            </label>
            <div className="d-field">
              <span className="d-field-label">Thème</span>
              <div className="d-filters">
                {FORM_THEMES.map((t) => (
                  <button key={t.id} type="button" className={`d-fswatch${t.id === form.theme ? " is-on" : ""}`} aria-pressed={t.id === form.theme} aria-label={`Thème ${t.name}`} title={t.name} onClick={() => change({ theme: t.id })}>
                    <span style={{ background: t.deep }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
