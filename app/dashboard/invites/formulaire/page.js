"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { longDate } from "@/lib/dash/format";
import {
  CUSTOM_MAX,
  CUSTOM_TYPES,
  FORM_THEMES,
  LOCKED_FIELDS,
  MESSAGE_MAX,
  PRESET_FIELDS,
  defaultForm,
  formTheme,
  formUrl,
  makeSlug,
  shrinkImage,
  withPresets,
} from "@/lib/dash/form";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";

const MODES = [
  { id: "off", label: "Non demandé" },
  { id: "opt", label: "Facultatif" },
  { id: "req", label: "Obligatoire" },
];

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="d-fseg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`d-fseg-btn is-${o.id}${value === o.id ? " is-on" : ""}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Intitulé d'une question, modifiable avec le crayon
function EditableLabel({ value, onSave, muted }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  if (editing) {
    const commit = () => {
      const next = draft.trim();
      if (next && next !== value) onSave(next);
      setEditing(false);
    };
    return (
      <span className="d-fq-edit">
        <input
          className="d-input"
          value={draft}
          autoFocus
          maxLength={120}
          aria-label="Intitulé de la question"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <Btn small onClick={commit}>
          Valider
        </Btn>
        <button type="button" className="d-link" onClick={() => setEditing(false)}>
          Annuler
        </button>
      </span>
    );
  }
  return (
    <span className="d-fq-label">
      <span style={{ color: muted ? "var(--d-muted)" : undefined }}>{value}</span>
      <button type="button" className="d-icon-btn" onClick={() => setEditing(true)} aria-label={`Modifier l’intitulé : ${value}`} title="Modifier l’intitulé">
        <Icon name="pencil" size={15} />
      </button>
    </span>
  );
}

export default function FormulaireInvites() {
  const dash = useDash();
  const data = dash.data;
  const [form, setForm] = useState(() => withPresets(data.form || defaultForm(data)));
  const [status, setStatus] = useState(data.form ? "saved" : "new");
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [newOptions, setNewOptions] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        <PageHeader back={{ href: "/dashboard/invites", label: "Les invités" }} title="Le formulaire invités." />
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
  const presenceOn = form.fields.find((f) => f.key === "presence")?.mode !== "off";
  const events = data.events;
  const inForm = events.filter((e) => form.event_ids.includes(e.id));
  const outForm = events.filter((e) => !form.event_ids.includes(e.id));
  const active = [...LOCKED_FIELDS.map((f) => ({ ...f, mode: "req" })), ...form.fields.filter((f) => f.mode !== "off"), ...form.custom.map((c) => ({ ...c, mode: c.req ? "req" : "opt" }))];
  const url = formUrl(form.slug);
  const coupleName = [data.wedding.partner1, data.wedding.partner2].filter(Boolean).join(" & ");

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

  function addCustom() {
    const label = newLabel.trim() || "Nouvelle question";
    const options = newType === "choice" ? newOptions.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 12) : [];
    change((f) => ({ custom: [...f.custom, { id: `q${Date.now().toString(36)}`, label: label.slice(0, 120), type: newType, options, req: false }] }));
    setAdding(false);
    setNewLabel("");
    setNewOptions("");
    setNewType("text");
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

  const statusLabel = { new: "", saving: "Enregistrement…", pending: "Modifications en cours…", saved: "Enregistré", error: "Pas enregistré, vérifiez votre connexion" }[status];

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/invites", label: "Les invités" }}
        title="Le formulaire invités."
        actions={<span className="d-small" role="status" style={{ color: status === "error" ? "var(--d-red-ink)" : "var(--d-muted)" }}>{statusLabel}</span>}
      />
      <p className="d-muted" style={{ margin: "-12px 0 0", maxWidth: 640, lineHeight: 1.5 }}>
        Un seul lien pour tous vos invités. Chaque réponse arrive directement dans votre liste, colonne par colonne.
      </p>

      <div className="d-grid-side d-form-grid-side">
        <section className="d-card">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h2>Les champs du formulaire</h2>
            <span className="d-small d-muted">
              {active.length} champs · {active.filter((f) => f.mode === "req").length} obligatoires
            </span>
          </div>

          <div className="d-col" style={{ gap: 8 }}>
            <div className="d-fq-head">
              <strong>1. Toujours demandés</strong>
              <span>Indispensables pour retrouver chaque invité dans votre liste. Vous ne pouvez pas les retirer.</span>
            </div>
            {LOCKED_FIELDS.map((f) => (
              <div key={f.key} className="d-fq is-locked">
                <span className="d-fq-label">
                  <Icon name="lock" size={15} />
                  {f.label}
                </span>
                <span className="d-fseg-static">Obligatoire</span>
              </div>
            ))}
          </div>

          <div className="d-col" style={{ gap: 8 }}>
            <div className="d-fq-head">
              <strong>2. Les informations que vous voulez recueillir</strong>
              <span>Le crayon permet de reformuler une question avec vos mots.</span>
            </div>
            <div className="d-fq-legend">
              <span>
                <strong>Non demandé</strong> : la question n'apparaît pas.
              </span>
              <span>
                <strong>Facultatif</strong> : l'invité peut la passer.
              </span>
              <span>
                <strong>Obligatoire</strong> : il ne peut pas envoyer sans répondre.
              </span>
            </div>
            {form.fields.map((f) => {
              const preset = PRESET_FIELDS.find((p) => p.key === f.key);
              return (
                <div key={f.key} className={`d-fq${f.mode === "off" ? " is-off" : ""}`}>
                  <div className="d-fq-row">
                    <span className="d-fq-text">
                      <EditableLabel value={f.label} muted={f.mode === "off"} onSave={(label) => setField(f.key, { label })} />
                      <span className="d-small d-muted">{preset?.hint}</span>
                    </span>
                    <Segmented value={f.mode} options={MODES} label={f.label} onChange={(mode) => setField(f.key, { mode })} />
                  </div>
                  {f.key === "presence" && presenceOn ? (
                    <div className="d-fq-moments">
                      <div>
                        <strong>Sur quels moments vos invités répondent-ils ?</strong>
                        <span>Cliquez sur un moment pour l'ajouter au formulaire ou l'en retirer.</span>
                      </div>
                      <div className="d-filters">
                        {events.map((e) => {
                          const on = form.event_ids.includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              className={`d-pill${on ? " is-on" : ""}`}
                              style={on ? { background: "var(--d-limetint)" } : undefined}
                              aria-pressed={on}
                              onClick={() => change((x) => ({ event_ids: on ? x.event_ids.filter((id) => id !== e.id) : events.map((ev) => ev.id).filter((id) => id === e.id || x.event_ids.includes(id)) }))}
                            >
                              <Icon name={on ? "check" : "plus"} size={13} sw={on ? 2.4 : 2} />
                              {e.name}
                            </button>
                          );
                        })}
                      </div>
                      <p>
                        <strong>Dans le formulaire :</strong> {inForm.length ? inForm.map((e) => e.name).join(", ") : "aucun moment"}. L'invité répond oui ou non pour chacun.
                      </p>
                      {outForm.length ? (
                        <p className="d-muted">
                          <strong style={{ color: "var(--d-ink)" }}>Pas dans le formulaire :</strong> {outForm.map((e) => e.name).join(", ")}. Pratique pour un moment réservé à quelques proches : tout le monde reçoit le même lien, donc tout le monde verrait la question. Ces réponses-là se notent directement dans la liste des invités.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="d-col" style={{ gap: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div className="d-fq-head">
                <strong>3. Vos questions à vous</strong>
                <span>Ajoutez ce qui manque, jusqu'à {CUSTOM_MAX} questions. Chacune devient une colonne de votre liste.</span>
              </div>
              <span className="d-small d-muted" style={{ whiteSpace: "nowrap" }}>
                {form.custom.length} sur {CUSTOM_MAX}
              </span>
            </div>
            {form.custom.map((c) => (
              <div key={c.id} className="d-fq">
                <div className="d-fq-row">
                  <span className="d-fq-text">
                    <EditableLabel value={c.label} onSave={(label) => setCustom(c.id, { label })} />
                    <span className="d-small d-muted">
                      Réponse : {CUSTOM_TYPES.find((t) => t.id === c.type)?.label.toLowerCase()}
                      {c.type === "choice" && c.options?.length ? ` (${c.options.join(", ")})` : ""}
                    </span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Segmented
                      value={c.req ? "req" : "opt"}
                      options={MODES.slice(1)}
                      label={c.label}
                      onChange={(m) => setCustom(c.id, { req: m === "req" })}
                    />
                    <button type="button" className="d-icon-btn" aria-label={`Supprimer : ${c.label}`} onClick={() => change((f) => ({ custom: f.custom.filter((x) => x.id !== c.id) }))}>
                      <Icon name="trash" size={16} />
                    </button>
                  </span>
                </div>
              </div>
            ))}
            {adding ? (
              <div className="d-card is-panel" style={{ gap: 14 }}>
                <label className="d-field">
                  <span className="d-field-label">Intitulé de la question</span>
                  <input className="d-input" value={newLabel} maxLength={120} autoFocus placeholder="Ex. : Votre chanson pour la soirée" onChange={(e) => setNewLabel(e.target.value)} />
                </label>
                <div className="d-field">
                  <span className="d-field-label">Type de réponse</span>
                  <div className="d-filters">
                    {CUSTOM_TYPES.map((t) => (
                      <button key={t.id} type="button" className={`d-pill${newType === t.id ? " is-on" : ""}`} style={newType === t.id ? { background: "var(--d-limetint)" } : undefined} aria-pressed={newType === t.id} onClick={() => setNewType(t.id)}>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <Btn onClick={addCustom}>Ajouter ce champ</Btn>
                  <Btn kind="ghost" onClick={() => setAdding(false)}>
                    Annuler
                  </Btn>
                </div>
              </div>
            ) : form.custom.length < CUSTOM_MAX ? (
              <button type="button" className="d-fq-add" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} sw={2} />
                Ajouter un champ
              </button>
            ) : null}
          </div>
        </section>

        <div className="d-col" style={{ gap: 24 }}>
          <section className="d-card">
            <h2>L'apparence</h2>
            <div className="d-field">
              <span className="d-field-label">Photo d'en-tête</span>
              <button type="button" className="d-fcover" onClick={() => fileInput.current?.click()} disabled={uploading} style={form.cover_url ? { backgroundImage: `url("${form.cover_url}")` } : undefined}>
                {form.cover_url ? (
                  <span className="d-fcover-change">{uploading ? "Envoi…" : "Changer la photo"}</span>
                ) : (
                  <>
                    <Icon name="upload" size={24} />
                    <strong>{uploading ? "Envoi…" : "Choisir une photo"}</strong>
                    <span className="d-small d-muted">Format paysage conseillé</span>
                  </>
                )}
              </button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickCover} />
              {form.cover_url ? (
                <button type="button" className="d-link" style={{ alignSelf: "flex-start" }} onClick={() => change({ cover_url: null })}>
                  Retirer la photo
                </button>
              ) : null}
            </div>
            <label className="d-field">
              <span className="d-field-label">Votre petit mot</span>
              <span className="d-field-hint">Affiché sous la date et le lieu, juste avant le formulaire.</span>
              <textarea className="d-textarea" rows={4} maxLength={MESSAGE_MAX} value={form.message || ""} placeholder="Ex. : Nous avons hâte de fêter ce jour avec vous…" onChange={(e) => change({ message: e.target.value.slice(0, MESSAGE_MAX) })} />
              <span className="d-field-hint" style={{ alignSelf: "flex-end" }}>
                {(form.message || "").length} / {MESSAGE_MAX}
              </span>
            </label>
            <label className="d-field">
              <span className="d-field-label">Date limite de réponse</span>
              <input className="d-input" type="date" value={form.deadline || ""} onChange={(e) => change({ deadline: e.target.value || null })} />
            </label>
            <div className="d-field">
              <span className="d-field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                Thème <span className="d-muted" style={{ fontWeight: 400 }}>{theme.name}</span>
              </span>
              <div className="d-filters">
                {FORM_THEMES.map((t) => (
                  <button key={t.id} type="button" className={`d-fswatch${t.id === form.theme ? " is-on" : ""}`} aria-pressed={t.id === form.theme} aria-label={`Thème ${t.name}`} title={t.name} onClick={() => change({ theme: t.id })}>
                    <span style={{ background: t.deep }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="d-fpreview" style={{ background: theme.bg }} aria-hidden="true">
              <div className="d-fpreview-cover" style={{ background: form.cover_url ? `center / cover url("${form.cover_url}")` : theme.deep }} />
              <div className="d-fpreview-body">
                <span style={{ color: theme.accent }}>Save the date</span>
                <strong>{coupleName}</strong>
                <em>{[data.wedding.wedding_date ? longDate(data.wedding.wedding_date) : null, data.wedding.venue].filter(Boolean).join(" · ")}</em>
                {form.message ? <p>{form.message}</p> : null}
                {active.slice(0, 5).map((f) => (
                  <div key={f.key || f.id} className="d-fpreview-line">
                    <small>{f.label}</small>
                    <i />
                  </div>
                ))}
                <b style={{ background: theme.accent }} />
              </div>
            </div>
            <Btn kind="ghost" href={`/f/${form.slug}`} target="_blank" className="d-btn-block">
              Visualiser la page invité
            </Btn>
          </section>

          <section className="d-card">
            <h2>Partager</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="d-field" style={{ flex: "1 1 200px" }}>
                <span className="d-field-label">Lien du formulaire</span>
                <input className="d-input" readOnly value={url} onFocus={(e) => e.target.select()} style={{ background: "var(--d-panel)" }} />
              </label>
              <Btn icon={copied ? "check" : "copy"} onClick={copy}>
                {copied ? "Lien copié" : "Copier le lien"}
              </Btn>
            </div>
            <p className="d-small d-muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Collez ce lien dans le groupe WhatsApp ou Facebook de la famille et des amis, ou envoyez-le en message. Chaque réponse s'ajoute à la liste des invités, et un invité déjà dans la liste est reconnu par son prénom et son nom.
              {data.form?.submissions ? ` ${data.form.submissions} réponse${data.form.submissions > 1 ? "s" : ""} reçue${data.form.submissions > 1 ? "s" : ""} jusqu'ici.` : ""}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
