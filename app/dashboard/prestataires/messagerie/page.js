"use client";

// Messagerie (canvas 6h) : les échanges avec les prestataires déjà contactés, dans l'ordre du dernier
// message. Les messages existaient déjà (vendor_messages, envoyés avec la demande de devis) mais
// n'avaient pas d'écran : une seule ligne dans Mes prestataires suffisait jusqu'ici.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { notifyVendor } from "@/lib/dash/vendorMail";
import { ago } from "@/components/dash/VendorComments";
import { Thumb, PrHead } from "@/components/dash/Prestataires";
import { Icon } from "@/components/dash/icons";

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
    out.push({ vendor, messages: sorted, last, unread: last?.from_vendor });
  }
  return out.sort((a, b) => String(b.last.sent_at).localeCompare(String(a.last.sent_at)));
}

export default function Messagerie() {
  const dash = useDash();
  const data = dash.data;
  const threads = useMemo(() => threadsOf(data), [data]);
  const [openId, setOpenId] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const current = threads.find((t) => t.vendor.id === openId) || threads[0] || null;

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !current || busy) return;
    setBusy(true);
    await dash.insert("vendor_messages", { vendor_id: current.vendor.id, from_vendor: false, author_id: data.meId || null, body, sent_at: new Date().toISOString() });
    if (dash.mode === "live") notifyVendor(current.vendor.id);
    setText("");
    setBusy(false);
  }

  return (
    <>
      <PrHead on="messagerie" />
      {!threads.length ? (
        <div className="d-card is-panel">
          <strong>Pas encore de conversation.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Les échanges apparaissent ici dès qu'une demande de devis est envoyée, dans « Mes prestataires ».
          </span>
        </div>
      ) : (
        <div className="d-msg-layout">
          <ul className="d-msg-list">
            {threads.map((t) => (
              <li key={t.vendor.id}>
                <button type="button" className={`d-msg-item${current?.vendor.id === t.vendor.id ? " is-on" : ""}`} onClick={() => setOpenId(t.vendor.id)}>
                  <Thumb v={t.vendor} size={44} />
                  <div className="d-msg-item-main">
                    <span className="d-msg-item-name">
                      {t.vendor.name}
                      {t.unread ? <span className="d-msg-dot" aria-hidden="true" /> : null}
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
                <div>
                  <h2>{current.vendor.name}</h2>
                  <span className="d-msg-thread-meta">{current.vendor.category}</span>
                </div>
                <Link href={`/dashboard/budget/prestataires/${current.vendor.id}`} className="d-pr-act">
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
