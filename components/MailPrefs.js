"use client";

// Interrupteurs « Notifications par mail » : Réglages du couple, Compte du prestataire.
// rows : [{ kind, label }]. En démo, rien n'est enregistré.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MailPrefs({ rows, live, onError }) {
  const [off, setOff] = useState(() => new Set());

  useEffect(() => {
    if (!live || !supabase) return undefined;
    let active = true;
    supabase.rpc("merry_mail_optouts").then(({ data }) => {
      if (active && data) setOff(new Set(data.map((row) => (typeof row === "string" ? row : row.merry_mail_optouts))));
    });
    return () => {
      active = false;
    };
  }, [live]);

  async function toggle(kind) {
    const next = !off.has(kind);
    const change = (add) =>
      setOff((current) => {
        const copy = new Set(current);
        if (add) copy.add(kind);
        else copy.delete(kind);
        return copy;
      });
    change(next);
    if (!live || !supabase) return;
    const { error } = await supabase.rpc("merry_set_mail_optout", { k: kind, opted_out: next });
    if (error) {
      change(!next);
      onError();
    }
  }

  return (
    <div className="d-card d-notif-list">
      {rows.map((row) => {
        const on = !off.has(row.kind);
        return (
          <button key={row.kind} type="button" className="d-fm-switch-row" role="switch" aria-checked={on} onClick={() => toggle(row.kind)}>
            <strong>{row.label}</strong>
            <span className={`d-fm-switch${on ? " is-on" : ""}`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
