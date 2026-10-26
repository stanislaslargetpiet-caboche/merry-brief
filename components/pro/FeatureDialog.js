"use client";

// « Proposer une fonctionnalité » (maquettes V9, V9b, V9m) : un mot à l'équipe Merry, une capture si besoin,
// puis « Merci » avec les propositions déjà envoyées et où elles en sont.

import { useRef, useState } from "react";
import { usePro } from "@/lib/pro/store";
import { shortDate } from "@/lib/dash/format";
import { ProIcon } from "./icons";
import { Sheet } from "./ui";

const STATUS = { recue: { label: "Reçue", cls: "" }, prevue: { label: "Prévue", cls: " is-planned" }, disponible: { label: "Disponible", cls: " is-live" } };

export default function FeatureDialog({ page, onClose }) {
  const pro = usePro();
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await pro.sendFeedback({ body: text, file, page });
    setBusy(false);
    if (ok) setSent(true);
  }

  if (sent) {
    const list = [...(pro.data.feedback || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return (
      <Sheet labelledBy="f-merci" onClose={onClose} className="p-feature">
        <div className="p-sheet-close-row">
          <CloseBtn onClose={onClose} />
        </div>
        <div className="p-merci">
          <span className="p-merci-badge">
            <ProIcon name="check" size={24} sw={2.4} />
          </span>
          <h2 id="f-merci">Merci, l’équipe Merry lit chaque demande.</h2>
        </div>
        <section className="p-feature-list">
          <h3>Vos propositions</h3>
          <ul>
            {list.map((f) => (
              <li key={f.id}>
                <span>
                  <span className="p-feature-body">{f.body}</span>
                  <span className="p-feature-when">Envoyée le {shortDate(String(f.created_at).slice(0, 10))}</span>
                </span>
                <span className={`p-chip${STATUS[f.status]?.cls || ""}`}>{STATUS[f.status]?.label || "Reçue"}</span>
              </li>
            ))}
          </ul>
        </section>
        <button type="button" className="p-btn p-btn-ghost p-center" onClick={onClose}>
          Fermer
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet labelledBy="f-titre" onClose={onClose} className="p-feature">
      <div className="p-sheet-head">
        <h2 id="f-titre">Qu’est-ce qui vous ferait gagner du temps ?</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <label htmlFor="f-txt" className="p-sr">
        Votre proposition
      </label>
      <textarea id="f-txt" rows={5} className="p-textarea" placeholder="Décrivez ce qui vous manque, avec vos mots." value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button type="button" className="p-dashed" onClick={() => fileRef.current?.click()}>
        <ProIcon name="image" size={18} />
        {file ? file.name : "Ajouter une capture d’écran"} {file ? null : <span className="p-dashed-note">(facultatif)</span>}
      </button>
      <div className="p-sheet-foot">
        <span className="p-note">Envoyé depuis : {page}</span>
        <button type="button" className="p-btn p-btn-primary is-big" onClick={send} disabled={busy || !text.trim()}>
          Envoyer
        </button>
      </div>
    </Sheet>
  );
}

export function CloseBtn({ onClose, label = "Fermer" }) {
  return (
    <button type="button" className="p-close" aria-label={label} onClick={onClose}>
      <ProIcon name="x" size={16} sw={2} />
    </button>
  );
}
