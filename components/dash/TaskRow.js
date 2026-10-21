"use client";

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { shortDate, daysUntil, todayIso } from "@/lib/dash/format";
import { isBoth } from "@/lib/dash/model";
import { Tile, Icon, guessIcon } from "./icons";
import { Btn, Checkbox, Field, PersonChip } from "./ui";

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
      <Field label="Qui s'en occupe" full>
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
  const { members } = dash.data;
  const [editing, setEditing] = useState(false);
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
        <span className={`d-task-date${late ? " is-late" : ""}`}>{task.done ? "Fait" : task.due_date ? shortDate(task.due_date) : "Sans date"}</span>
        <span className="d-task-who">
          <TaskWho task={task} members={members} />
        </span>
      </div>
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
