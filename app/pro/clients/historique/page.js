"use client";

// Anciens clients (maquette V1, ajoutée le 3 nov. 2026 : 3e onglet de Messagerie, « façon Airbnb »)
// : les mariages passés et les couples perdus, séparés des Réservations actives. Même liste que
// Réservations (toute la ligne s'ouvre, depuis l'audit du 3 nov.), qui ouvre la même fiche (messages, documents).

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { guestsText, isPastClient, weddingWhen } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Face, ProSubnav } from "@/components/pro/ui";
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
  const past = (pro.data.clients || []).filter(isPastClient);
  const all = past
    .filter((c) => !q.trim() || norm(c.names).includes(norm(q.trim())))
    .sort((a, b) => String(b.wedding_date || b.updated_at || "").localeCompare(String(a.wedding_date || a.updated_at || "")));
  const open = params.get("client");
  // Cherché parmi tous les clients : le panneau reste ouvert quand l'étape change
  const current = (pro.data.clients || []).find((c) => c.id === open) || null;
  const close = () => router.push("/pro/clients/historique", { scroll: false });

  return (
    <div className={`p-clients${current ? " is-open" : ""}`}>
      <h1 className="p-h1 is-page">Anciens clients.</h1>
      <ProSubnav items={PRO_MESSAGERIE_TABS} label="Sections de Messagerie" />
      {past.length ? (
        <div className="p-clients-tools">
          <div className="p-search">
            <ProIcon name="search" size={16} stroke="#6b6a63" />
            <label htmlFor="q" className="p-sr">
              Rechercher un client
            </label>
            <input id="q" type="search" className="p-input" placeholder="Rechercher un client" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      ) : null}

      {all.length ? (
        <ul aria-label="Anciens clients" className="p-dem-items">
          {all.map((c) => {
            const on = current?.id === c.id;
            return (
              <li key={c.id}>
                <button type="button" aria-current={on ? "true" : undefined} className={`p-dem-item${on ? " is-on" : ""}`} onClick={() => router.push(`/pro/clients/historique?client=${c.id}`, { scroll: false })}>
                  <span aria-hidden="true" className="p-dot is-empty" />
                  <Face names={c.names} size={40} />
                  <span className="p-dem-text">
                    <span className="p-dem-line">
                      <span className="p-dem-name">{c.names}</span>
                      <span className={`p-chip is-small${c.stage === "perdu" ? "" : " is-dark"}`}>{c.stage === "perdu" ? "Perdu" : "Terminé"}</span>
                    </span>
                    <span className="p-dem-meta">{[weddingWhen(c, { short: true }), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-empty-line">{past.length ? "Aucun client ne porte ce nom." : "Aucun ancien client pour l’instant."}</p>
      )}

      {current ? <ClientPanel key={current.id} c={current} onClose={close} backLabel="Anciens clients" /> : null}
    </div>
  );
}
