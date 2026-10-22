"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { shortDate, daysUntil, todayIso } from "@/lib/dash/format";
import { isBoth } from "@/lib/dash/model";
import { Tile, Icon, guessIcon } from "./icons";
import { Avatar, Btn, Checkbox, Field, PersonChip } from "./ui";

// « à l'instant », « il y a 5 min », « il y a 2 h », « hier », puis la date
function ago(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24 && new Date(t).toDateString() === new Date().toDateString()) return `il y a ${h} h`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (new Date(t).toDateString() === yesterday.toDateString()) return "hier";
  return shortDate(iso.slice(0, 10));
}

// Fil de commentaires d'une tâche : chaque organisateur écrit en son nom
function TaskThread({ task, comments, onClose }) {
  const dash = useDash();
  const { members, meId } = dash.data;
  const [text, setText] = useState("");
  const me = members.find((m) => m.id === meId);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    await dash.insert("task_comments", { task_id: task.id, author_id: meId, body: body.slice(0, 2000), created_at: new Date().toISOString() });
  }

  return (
    <div className="d-thread">
      <div className="d-thread-head">
        <span>{comments.length ? `${comments.length} commentaire${comments.length > 1 ? "s" : ""}` : "Commentaires"}</span>
        <button type="button" className="d-pill" style={{ minHeight: 30, fontSize: 12 }} onClick={onClose}>
          <Icon name="chevUp" size={12} sw={2.2} />
          Masquer
        </button>
      </div>
      {comments.map((c) => {
        const who = members.find((m) => m.id === c.author_id);
        return (
          <div key={c.id} className="d-comment">
            {who ? <Avatar member={who} size={28} /> : <span className="d-comment-ghost" />}
            <div className="d-comment-body">
              <div className="d-comment-head">
                <strong>{who?.display_name || "Ancien organisateur"}</strong>
                <span>{ago(c.created_at)}</span>
                {c.author_id && c.author_id === meId ? (
                  <button
                    type="button"
                    className="d-link"
                    onClick={() => {
                      if (window.confirm("Supprimer ce commentaire ?")) dash.remove("task_comments", c.id);
                    }}
                  >
                    Supprimer
                  </button>
                ) : null}
              </div>
              <p>{c.body}</p>
            </div>
          </div>
        );
      })}
      <form className="d-comment-form" onSubmit={send}>
        {me ? <Avatar member={me} size={28} /> : null}
        <input className="d-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un commentaire…" aria-label={`Commenter : ${task.title}`} maxLength={2000} />
        <button type="submit" className="d-send" aria-label="Envoyer" disabled={!text.trim()}>
          <Icon name="send" size={16} sw={2} />
        </button>
      </form>
    </div>
  );
}

export function TaskWho({ task, members }) {
  const list = (task.assignees || []).map((id) => members.find((m) => m.id === id)).filter(Boolean);
  if (isBoth(task.assignees || [], members)) return <PersonChip members={list} label="Vous deux" color="jaune" />;
  return <PersonChip members={list} />;
}

export function AssigneePicker({ value, onChange, members }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="d-filters">
      {members.map((m) => (
        <button key={m.id} type="button" className={`d-pill${value.includes(m.id) ? " is-on" : ""}`} onClick={() => toggle(m.id)} aria-pressed={value.includes(m.id)}>
          {m.display_name}
        </button>
      ))}
    </div>
  );
}

export function TaskForm({ task, onDone, onDelete }) {
  const dash = useDash();
  const { members } = dash.data;
  const [title, setTitle] = useState(task?.title || "");
  const [due, setDue] = useState(task?.due_date || "");
  const [assignees, setAssignees] = useState(task?.assignees || []);

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const patch = { title: title.trim(), due_date: due || null, assignees, icon: task?.icon && task.title === title.trim() ? task.icon : guessIcon(title) };
    if (task) await dash.update("tasks", task.id, patch);
    else await dash.insert("tasks", { ...patch, done: false, added_by_merry: false, position: dash.data.tasks.length });
    onDone();
  }

  return (
    <form className="d-task-edit" onSubmit={save}>
      <Field label="Tâche">
        <input className="d-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Réserver le photographe" autoFocus required />
      </Field>
      <Field label="Pour le">
        <input className="d-input" type="date" value={due || ""} min={task ? undefined : todayIso()} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="Qui s'en occupe" full group>
        <AssigneePicker value={assignees} onChange={setAssignees} members={members} />
      </Field>
      <div className="d-actions-end" style={{ gridColumn: "1 / -1" }}>
        {onDelete ? (
          <Btn kind="ghost" small icon="trash" onClick={onDelete}>
            Supprimer
          </Btn>
        ) : null}
        <span style={{ flex: 1 }} />
        <Btn kind="ghost" small onClick={onDone}>
          Annuler
        </Btn>
        <Btn type="submit" small>
          {task ? "Enregistrer" : "Ajouter la tâche"}
        </Btn>
      </div>
    </form>
  );
}

export default function TaskRow({ task }) {
  const dash = useDash();
  const { members, comments = [], commentsOn } = dash.data;
  const [editing, setEditing] = useState(false);
  const [talk, setTalk] = useState(false);
  const mine = comments.filter((c) => c.task_id === task.id);
  const late = !task.done && task.due_date && daysUntil(task.due_date) < 0;

  const toggle = (done) => dash.update("tasks", task.id, { done, done_at: done ? new Date().toISOString() : null });

  return (
    <div className={`d-task${task.done ? " is-done" : ""}`}>
      <div className="d-task-main">
        <Checkbox done={task.done} onChange={toggle} label={task.done ? `Décocher : ${task.title}` : `Cocher : ${task.title}`} />
        <Tile name={task.icon || guessIcon(task.title)} />
        <button type="button" className="d-task-title" onClick={() => setEditing((x) => !x)} title="Modifier la tâche">
          <span>{task.title}</span>
          {task.added_by_merry ? (
            <span className="d-badge d-badge-merry">
              <Icon name="sparkle" size={12} sw={2} />
              Ajoutée par Merry
            </span>
          ) : null}
        </button>
      </div>
      <div className="d-task-side">
        {commentsOn ? (
          <button
            type="button"
            className={`d-bubble${talk ? " is-open" : ""}${mine.length ? "" : " is-empty"}`}
            onClick={() => setTalk((x) => !x)}
            aria-expanded={talk}
            aria-label={mine.length ? `${mine.length} commentaire${mine.length > 1 ? "s" : ""} sur : ${task.title}` : `Commenter : ${task.title}`}
            title={talk ? "Masquer les commentaires" : mine.length ? "Voir les commentaires" : "Commenter"}
          >
            <Icon name="bubble" size={14} sw={2} />
            {mine.length ? mine.length : null}
          </button>
        ) : null}
        <span className={`d-task-date${late ? " is-late" : ""}`}>{task.done ? "Fait" : task.due_date ? shortDate(task.due_date) : "Sans date"}</span>
        <span className="d-task-who">
          <TaskWho task={task} members={members} />
        </span>
      </div>
      {talk && commentsOn ? <TaskThread task={task} comments={mine} onClose={() => setTalk(false)} /> : null}
      {editing ? (
        <TaskForm
          task={task}
          onDone={() => setEditing(false)}
          onDelete={() => {
            if (window.confirm(`Supprimer « ${task.title} » ?`)) dash.remove("tasks", task.id);
          }}
        />
      ) : null}
    </div>
  );
}
