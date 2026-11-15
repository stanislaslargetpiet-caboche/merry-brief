"use client";

// Bouton Aide (menu latéral) : soit prendre rendez-vous sur le calendrier de Stan (flow d'origine),
// soit écrire directement un message, envoyé par mail (route /api/aide) à l'adresse de support Merry.
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { CALENDLY_URL } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import { Btn, Field, Modal } from "./ui";

export default function AideModal({ onClose }) {
  const dash = useDash();
  const { members, wedding, meId } = dash.data || {};
  const meName = (members || []).find((m) => m.id === meId)?.display_name || "";
  const weddingName = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ");

  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function send(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setError(false);
    try {
      if (dash.mode !== "live" || !supabase) throw new Error("demo");
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/aide", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${sess?.session?.access_token}` },
        body: JSON.stringify({ message: text, name: meName, weddingName }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Modal title="Message envoyé" onClose={onClose}>
        <p className="d-small">On te répond au plus vite, par mail.</p>
        <Btn onClick={onClose}>Fermer</Btn>
      </Modal>
    );
  }

  if (writing) {
    return (
      <Modal title="Envoyer un message" onClose={onClose}>
        <form onSubmit={send}>
          <Field label="Où bloques-tu ?" full>
            <textarea className="d-textarea" rows={5} maxLength={2000} autoFocus value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Décris ce qui ne marche pas ou ce qui n'est pas clair…" />
          </Field>
          {error ? <p className="d-small" style={{ color: "var(--d-red-ink)" }}>Le message n'a pas pu partir. Réessaie dans un instant.</p> : null}
          <Btn type="submit" disabled={!message.trim() || sending}>
            {sending ? "Envoi…" : "Envoyer"}
          </Btn>
        </form>
      </Modal>
    );
  }

  return (
    <Modal title="Besoin d'aide ?" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn icon="calendar" href={CALENDLY_URL} target="_blank" onClick={onClose}>
          Prendre rendez-vous
        </Btn>
        <Btn icon="mail" kind="ghost" onClick={() => setWriting(true)}>
          Envoyer un message
        </Btn>
      </div>
    </Modal>
  );
}
