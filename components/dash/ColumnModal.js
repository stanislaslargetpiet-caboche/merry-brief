"use client";

// Colonne ajoutée à la liste des invités : qui la remplit (les invités, par le
// formulaire, ou les organisateurs) et sous quel format (texte libre ou réponses
// prédéfinies). Une colonne « invités » est aussi une question du formulaire.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { columnValues } from "@/lib/dash/codes";
import { defaultForm } from "@/lib/dash/form";
import { Icon } from "./icons";
import { FieldGroupsModal } from "./FieldGroupsModal";
import { Btn, Field, Modal, Popover } from "./ui";

export const DEFAULT_OPTIONS = ["Oui", "Non", "Ne sait pas"];

const SOURCES = [
  { id: "invites", title: "Rempli par les invités", hint: "La question est ajoutée au formulaire invités ; vous attendez leur réponse, comme pour le mail, le régime ou l'adresse." },
  { id: "organisateurs", title: "Pour les organisateurs", hint: "Colonne interne, invisible des invités : vous la remplissez vous-mêmes, à la main ou avec des réponses prédéfinies." },
];

function parseOptions(text) {
  const seen = new Set();
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, 12);
}

// Garde le formulaire invités en phase avec les colonnes « invités »
async function syncForm(dash, field, action) {
  const data = dash.data;
  if (!data.formSetup) return;
  const base = data.form || defaultForm(data);
  const custom = Array.isArray(base.custom) ? base.custom : [];
  const q = { id: field.id, field_id: field.id, label: field.name.slice(0, 120), type: field.kind === "choice" ? "choice" : "text", options: field.kind === "choice" ? field.options || [] : [], req: false };
  const matches = (c) => c.id === field.id || c.label.trim().toLowerCase() === field.name.trim().toLowerCase();
  let next;
  if (action === "remove") next = custom.filter((c) => !matches(c));
  else if (custom.some(matches)) next = custom.map((c) => (matches(c) ? { ...c, label: q.label, type: q.type, options: q.options } : c));
  else next = [...custom, q];
  if (action === "remove" && next.length === custom.length) return;
  await dash.saveForm({ ...base, custom: next });
}

export function ColumnModal({ field, onClose }) {
  const dash = useDash();
  const { fields, fieldsSetup } = dash.data;
  const [name, setName] = useState(field?.name || "");
  const [source, setSource] = useState(field?.source || "organisateurs");
  const [kind, setKind] = useState(field?.kind || "text");
  const [options, setOptions] = useState((field?.options?.length ? field.options : DEFAULT_OPTIONS).join(", "));
  const canFormat = dash.mode === "demo" || fieldsSetup;

  async function save(e) {
    e?.preventDefault();
    const label = name.trim().slice(0, 120);
    if (!label) return;
    const opts = kind === "choice" ? parseOptions(options) : [];
    if (kind === "choice" && opts.length < 2) return;
    const row = { name: label, source, kind, options: opts };
    if (field) {
      await dash.update("guest_fields", field.id, row);
      const wasInvites = field.source === "invites";
      if (source === "invites") await syncForm(dash, { ...field, ...row }, "upsert");
      else if (wasInvites) await syncForm(dash, field, "remove");
    } else {
      const [created] = await dash.insert("guest_fields", { ...row, position: fields.length });
      if (source === "invites") await syncForm(dash, created, "upsert");
    }
    onClose();
  }

  const optionList = parseOptions(options);

  return (
    <Modal
      title={field ? "Modifier la colonne" : "Ajouter une colonne"}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!name.trim() || (kind === "choice" && optionList.length < 2)}>
            {field ? "Enregistrer" : "Ajouter"}
          </Btn>
        </>
      }
    >
      <form className="d-col" onSubmit={save} style={{ gap: 18 }}>
        <Field label="Nom de la colonne">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Vient en voiture, navette, table, cadeau reçu…" maxLength={120} />
        </Field>

        <Field label="Qui la remplit ?" group>
          <div className="d-col" style={{ gap: 8 }}>
            {SOURCES.map((s) => (
              <button key={s.id} type="button" className={`d-choice${source === s.id ? " is-on" : ""}`} aria-pressed={source === s.id} onClick={() => setSource(s.id)} disabled={!canFormat && s.id === "invites"}>
                <span className="d-radio" />
                <span className="d-choice-text">
                  <strong>{s.title}</strong>
                  <span>{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Field>

        {canFormat ? (
          <Field label="Format de réponse" group>
            <div className="d-col" style={{ gap: 8 }}>
              <button type="button" className={`d-choice${kind === "text" ? " is-on" : ""}`} aria-pressed={kind === "text"} onClick={() => setKind("text")}>
                <span className="d-radio" />
                <span className="d-choice-text">
                  <strong>Texte libre</strong>
                  <span>{source === "invites" ? "L'invité écrit sa réponse." : "Vous écrivez ce que vous voulez dans la case."}</span>
                </span>
              </button>
              <button type="button" className={`d-choice${kind === "choice" ? " is-on" : ""}`} aria-pressed={kind === "choice"} onClick={() => setKind("choice")}>
                <span className="d-radio" />
                <span className="d-choice-text">
                  <strong>Réponses prédéfinies</strong>
                  <span>{source === "invites" ? "L'invité choisit parmi vos réponses." : "Un clic sur la case pour choisir : Oui, Non, Ne sait pas…"}</span>
                </span>
              </button>
            </div>
          </Field>
        ) : (
          <div className="d-card is-panel" style={{ gap: 6 }}>
            <strong style={{ fontSize: 14 }}>Les formats de réponse ne sont pas encore installés sur la base.</strong>
            <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
              Collez <code>supabase/colonnes.sql</code> dans Supabase (SQL Editor), puis rechargez. En attendant, la colonne est en texte libre pour les organisateurs.
            </span>
          </div>
        )}

        {canFormat && kind === "choice" ? (
          <Field label="Réponses possibles" hint="Séparées par des virgules, 12 au plus. La première est proposée en premier.">
            <input className="d-input" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Oui, Non, Ne sait pas" />
            {optionList.length ? (
              <div className="d-filters" style={{ marginTop: 8 }}>
                {optionList.map((o) => (
                  <span key={o} className="d-pill" style={{ minHeight: 30, fontSize: 12 }}>
                    {o}
                  </span>
                ))}
              </div>
            ) : null}
          </Field>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// En-tête d'une colonne ajoutée : menu modifier / supprimer, icône selon qui la remplit
export function FieldHeader({ field }) {
  const dash = useDash();
  const { guests } = dash.data;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const canGroup = columnValues(dash.data.guests, field.id).length > 0; // quelques valeurs distinctes : on peut en faire des groupes
  const firstOption = field.kind === "choice" ? (field.options || [])[0] : null;
  const filledCount = guests.filter((g) => (g.custom || {})[field.id]).length;

  async function checkAll() {
    if (!firstOption) return;
    setOpen(false);
    const msg =
      filledCount && filledCount < guests.length
        ? `Mettre « ${firstOption} » dans « ${field.name} » pour tous les invités ? ${filledCount} ont déjà une valeur dans cette colonne : elle sera remplacée.`
        : `Mettre « ${firstOption} » dans « ${field.name} » pour les ${guests.length} invités ?`;
    if (!window.confirm(msg)) return;
    // Un invité à la fois : on garde ses autres colonnes, seule celle-ci change
    await Promise.all(guests.map((g) => dash.update("guests", g.id, { custom: { ...(g.custom || {}), [field.id]: firstOption } })));
  }

  async function uncheckAll() {
    setOpen(false);
    if (!filledCount) return;
    if (!window.confirm(`Vider « ${field.name} » pour les ${filledCount} invité${filledCount > 1 ? "s" : ""} qui ont une valeur ?`)) return;
    await Promise.all(
      guests
        .filter((g) => (g.custom || {})[field.id])
        .map((g) => {
          const { [field.id]: _drop, ...rest } = g.custom || {};
          return dash.update("guests", g.id, { custom: rest });
        }),
    );
  }

  return (
    <span className="d-anchor">
      <button
        type="button"
        className="d-link d-field-head"
        title={field.source === "invites" ? "Question posée aux invités dans le formulaire" : "Colonne remplie par les organisateurs"}
        onClick={() => setOpen((o) => !o)}
      >
        {field.source === "invites" ? <Icon name="link" size={12} sw={2.2} /> : null}
        {field.name.toUpperCase()}
        <Icon name="chevDown" size={11} sw={2.2} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right">
        <button
          type="button"
          className="d-pop-item"
          onClick={() => {
            setOpen(false);
            setEditing(true);
          }}
        >
          <span className="d-pop-label">
            <Icon name="pencil" size={14} sw={2} />
            Modifier la colonne
          </span>
        </button>
        {firstOption ? (
          <button type="button" className="d-pop-item" onClick={checkAll}>
            <span className="d-pop-label">
              <Icon name="check" size={14} sw={2.2} />
              Tout cocher « {firstOption} »
            </span>
          </button>
        ) : null}
        {firstOption ? (
          <button type="button" className="d-pop-item" onClick={uncheckAll} disabled={!filledCount}>
            <span className="d-pop-label">
              <Icon name="x" size={14} sw={2.2} />
              Tout décocher
            </span>
          </button>
        ) : null}
        {canGroup ? (
          <button
            type="button"
            className="d-pop-item"
            onClick={() => {
              setOpen(false);
              setGrouping(true);
            }}
          >
            <span className="d-pop-label">
              <Icon name="users" size={14} sw={2} />
              Ranger les invités en groupes
            </span>
          </button>
        ) : null}
        <button
          type="button"
          className="d-pop-item is-danger"
          onClick={async () => {
            setOpen(false);
            if (!window.confirm(`Supprimer la colonne « ${field.name} » et son contenu ?`)) return;
            if (field.source === "invites") await syncForm(dash, field, "remove");
            dash.remove("guest_fields", field.id);
          }}
        >
          <span className="d-pop-label">
            <Icon name="trash" size={14} sw={2} />
            Supprimer la colonne
          </span>
        </button>
      </Popover>
      {editing ? <ColumnModal field={field} onClose={() => setEditing(false)} /> : null}
      {grouping ? <FieldGroupsModal field={field} onClose={() => setGrouping(false)} /> : null}
    </span>
  );
}

// Case d'une colonne à réponses prédéfinies : une pastille, un clic pour choisir
export function ChoiceCell({ value, options, label, onChange }) {
  const [open, setOpen] = useState(false);
  const list = options?.length ? options : DEFAULT_OPTIONS;
  const tone = (v) => {
    const n = String(v || "").toLowerCase();
    if (/^(oui|yes|ok|fait)$/.test(n)) return "is-yes";
    if (/^(non|no)$/.test(n)) return "is-no";
    return "";
  };
  return (
    <span className="d-anchor">
      <button type="button" className={`d-choicepill${value ? ` ${tone(value)}` : " is-empty"}${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)} title={`${label} : choisir`} aria-haspopup="menu" aria-expanded={open}>
        {value || "–"}
        <Icon name="chevDown" size={11} sw={2.2} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        {list.map((o) => (
          <button
            key={o}
            type="button"
            className={`d-pop-item${o === value ? " is-on" : ""}`}
            onClick={() => {
              onChange(o === value ? null : o);
              setOpen(false);
            }}
          >
            {o}
            {o === value ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
        {value ? (
          <button
            type="button"
            className="d-pop-item"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span className="d-muted">Effacer</span>
          </button>
        ) : null}
      </Popover>
    </span>
  );
}
