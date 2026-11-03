"use client";

// Anciens clients (maquette V1, ajoutée le 3 nov. 2026 : 3e onglet de Messagerie, « façon Airbnb »)
// : les mariages passés et les couples perdus, séparés des Réservations actives. Simple liste,
// « Voir l'historique » ouvre la même fiche (messages, documents) que Réservations, en lecture.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { dateLong, guestsText, isPastClient } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { ProSubnav } from "@/components/pro/ui";
import { PRO_MESSAGERIE_TABS } from "@/components/pro/Shell";
import ClientPanel from "@/components/pro/ClientPanel";

export default function HistoriquePage() {
  return (
    <Suspense>
      <Historique />
    </Suspense>
  );
}

function Historique() {
  const pro = usePro();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const norm = (s) => String(s || "").toLowerCase();
  const all = (pro.data.clients || [])
    .filter(isPastClient)
    .filter((c) => !q.trim() || norm(c.names).includes(norm(q.trim())))
    .sort((a, b) => String(b.wedding_date || b.updated_at || "").localeCompare(String(a.wedding_date || a.updated_at || "")));
  const open = params.get("client");
  const current = all.find((c) => c.id === open) || null;
  const close = () => router.push("/pro/clients/historique", { scroll: false });

  return (
    <div className={`p-clients${current ? " is-open" : ""}`}>
      <div className="p-clients-head">
        <h1 className="p-h1 is-page">Anciens clients.</h1>
        <div className="p-clients-tools">
          <div className="p-search">
            <ProIcon name="search" size={16} stroke="#6b6a63" />
            <label htmlFor="q" className="p-sr">
              Rechercher
            </label>
            <input id="q" type="search" className="p-input" placeholder="Rechercher un client" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <ProSubnav items={PRO_MESSAGERIE_TABS} label="Sections de Messagerie" />

      {all.length ? (
        <section className="p-card p-options">
          <ul className="p-rows">
            {all.map((c) => (
              <li key={c.id} className="p-ancien-row">
                <span className="p-ancien-who">
                  <strong>{c.names}</strong>
                  <span className="p-muted">{[c.wedding_date ? dateLong(c.wedding_date) : null, guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                </span>
                <span className={`p-chip ${c.stage === "perdu" ? "" : "is-dark"}`}>{c.stage === "perdu" ? "Perdu" : "Terminé"}</span>
                <button type="button" className="p-btn p-btn-ghost is-135" onClick={() => router.push(`/pro/clients/historique?client=${c.id}`, { scroll: false })}>
                  Voir l’historique
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="p-empty-line">Aucun ancien client pour l’instant.</p>
      )}

      {current ? <ClientPanel c={current} onClose={close} backLabel="Anciens clients" /> : null}
    </div>
  );
}
