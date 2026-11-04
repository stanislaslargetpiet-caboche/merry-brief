"use client";

// Messagerie (canvas 6h) : les échanges avec les prestataires déjà contactés, dans l'ordre du dernier
// message. Les messages existaient déjà (vendor_messages, envoyés avec la demande de devis) mais
// n'avaient pas d'écran : une seule ligne dans Mes prestataires suffisait jusqu'ici.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDash } from "@/lib/dash/store";
import { notifyVendor } from "@/lib/dash/vendorMail";
import { isVendorThreadUnread } from "@/lib/dash/picks";
import { ago } from "@/components/dash/VendorComments";
import { Thumb, useIsPhone } from "@/components/dash/Prestataires";
import { Icon } from "@/components/dash/icons";
import { PageHeader } from "@/components/dash/ui";

function threadsOf(data) {
  const byVendor = new Map();
  for (const m of data.messages || []) {
    if (!byVendor.has(m.vendor_id)) byVendor.set(m.vendor_id, []);
    byVendor.get(m.vendor_id).push(m);
  }
  const out = [];
  for (const [vendorId, msgs] of byVendor) {
    const vendor = data.vendors.find((v) => v.id === vendorId);
    if (!vendor) continue;
    const sorted = msgs.slice().sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)));
    const last = sorted[sorted.length - 1];
    out.push({ vendor, messages: sorted, last, unread: isVendorThreadUnread(vendor, data) });
  }
  return out.sort((a, b) => String(b.last.sent_at).localeCompare(String(a.last.sent_at)));
}

export default function Messagerie() {
  const dash = useDash();
  const data = dash.data;
  const phone = useIsPhone();
  const threads = useMemo(() => threadsOf(data), [data]);
  const [openId, setOpenId] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Téléphone : un seul panneau à la fois (comme Airbnb), la liste d'abord, le fil une fois un
  // échange choisi. Ordinateur : la liste et le fil côte à côte, le plus récent ouvert d'emblée.
  const current = threads.find((t) => t.vendor.id === openId) || (phone ? null : threads[0]) || null;

  // Un fil lu (affiché à l'écran) pose la date de lecture sur le prestataire : la pastille disparaît,
  // ici comme sur le bouton Messagerie de la navigation.
  useEffect(() => {
    if (!current?.unread) return;
    dash.update("vendors", current.vendor.id, { messages_read_at: new Date().toISOString() });
  }, [current?.vendor.id, current?.unread]);

  // Un prestataire sans adresse ni compte ne saura jamais qu'on lui a écrit : autant le dire au couple
  const [unreachable, setUnreachable] = useState(false);
  const noEmail = !!current && !String(current.vendor.email || "").trim();
  useEffect(() => {
    if (!noEmail) {
      setUnreachable(false);
      return undefined;
    }
    setUnreachable(true);
    if (dash.mode !== "live" || !supabase) return undefined;
    let active = true;
    supabase.rpc("merry_vendor_reachable", { v: current.vendor.id }).then(({ data: reachable }) => {
      if (active && reachable === true) setUnreachable(false);
    });
    return () => {
      active = false;
    };
  }, [noEmail, current?.vendor.id, dash.mode]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !current || busy) return;
    setBusy(true);
    await dash.insert("vendor_messages", { vendor_id: current.vendor.id, from_vendor: false, author_id: data.meId || null, body, sent_at: new Date().toISOString() });
    if (dash.mode === "live") notifyVendor(current.vendor.id, { message: body });
    setText("");
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Messagerie." />
      {!threads.length ? (
        <div className="d-card is-panel">
          <strong>Pas encore de conversation.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Les échanges apparaissent ici dès qu'une demande de devis est envoyée, dans « Mes prestataires ».
          </span>
        </div>
      ) : (
        <div className={`d-msg-layout${phone && current ? " is-thread" : ""}`}>
          <ul className="d-msg-list">
            {threads.map((t) => (
              <li key={t.vendor.id}>
                <button type="button" className={`d-msg-item${current?.vendor.id === t.vendor.id ? " is-on" : ""}`} onClick={() => setOpenId(t.vendor.id)}>
                  <Thumb v={t.vendor} size={48} />
                  <div className="d-msg-item-main">
                    <span className="d-msg-item-name">
                      <span className="d-msg-item-name-text">
                        {t.unread ? <span className="d-msg-dot" aria-hidden="true" /> : null}
                        {t.vendor.name}
                      </span>
                      <span className="d-msg-item-time">{ago(t.last.sent_at)}</span>
                    </span>
                    <span className="d-msg-item-prev">{t.last.body}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <section className="d-msg-thread">
              <div className="d-msg-thread-head">
                {phone ? (
                  <button type="button" className="d-msg-back" onClick={() => setOpenId(null)} aria-label="Revenir aux conversations">
                    <Icon name="back" size={18} sw={2.2} />
                  </button>
                ) : null}
                <div className="d-msg-thread-head-main">
                  <h2>{current.vendor.name}</h2>
                  <span className="d-msg-thread-meta">{current.vendor.category}</span>
                </div>
                <Link href={`/dashboard/prestataires/mes?vendor=${current.vendor.id}`} className="d-pr-act">
                  Voir la fiche
                </Link>
              </div>
              <div className="d-msg-bubbles">
                {current.messages.map((m) => (
                  <div key={m.id} className={`d-msg-row ${m.from_vendor ? "is-them" : "is-me"}`}>
                    <div className="d-msg-bubble">{m.body}</div>
                    <span className="d-msg-time">
                      {m.from_vendor ? current.vendor.name : "Vous"} · {ago(m.sent_at)}
                    </span>
                  </div>
                ))}
              </div>
              {unreachable ? (
                <div className="d-msg-noaddress">
                  <span>{current.vendor.name} n'a pas d'adresse mail sur Merry : il ne sera pas prévenu de votre message.</span>
                  {current.vendor.phone ? (
                    <a href={`tel:${String(current.vendor.phone).replace(/\s/g, "")}`}>Appeler le {current.vendor.phone}</a>
                  ) : null}
                </div>
              ) : null}
              <form className="d-msg-composer" onSubmit={send}>
                <input type="text" className="d-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" aria-label="Écrire un message" />
                <button type="submit" className="d-msg-send" aria-label="Envoyer" disabled={!text.trim() || busy}>
                  <Icon name="send" size={16} sw={2} stroke="#fff" />
                </button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
