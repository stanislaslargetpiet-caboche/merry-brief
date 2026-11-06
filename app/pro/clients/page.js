"use client";

// Réservations (maquette V1, fusion canvas du 3 nov. 2026 « façon Airbnb » : liste simple plutôt
// que le tableau à colonnes d'avant) : les couples actifs, de la demande à la réservation. Ceux
// venus par Merry ont leurs échanges avec le prestataire ; les autres (« Hors Merry ») s'ajoutent à
// la main. Perdus et mariages passés basculent dans Anciens clients (/pro/clients/historique).
// ?client=… ouvre la fiche du client ; ?ecrire=1 met le curseur dans le message.

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { dayShort, guestsText, isPastClient, STAGES, weddingWhen } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Face, ProSubnav } from "@/components/pro/ui";
import { PRO_CLIENTS_TABS } from "@/components/pro/Shell";
import ClientPanel, { NEW_CLIENT } from "@/components/pro/ClientPanel";

const ACTIVE_STAGES = STAGES.filter((s) => s.key !== "perdu");

export default function ClientsPage() {
  return (
    <Suspense>
      <Clients />
    </Suspense>
  );
}

function Clients() {
  const pro = usePro();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("toutes");
  // Une demande Merry pas encore répondue se traite dans Demandes, pas ici (sinon deux endroits pour
  // répondre au même couple) ; un client ajouté à la main reste ici quelle que soit son étape
  const all = (pro.data.clients || []).filter((c) => !isPastClient(c) && !(c.source === "merry" && c.stage === "nouvelle"));
  const norm = (s) => String(s || "").toLowerCase();
  const shown = all
    .filter((c) => !q.trim() || norm(c.names).includes(norm(q.trim())) || norm(c.email).includes(norm(q.trim())))
    .filter((c) => stage === "toutes" || c.stage === stage)
    .sort((a, b) => String(a.next_action_on || "9").localeCompare(String(b.next_action_on || "9")) || String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  const open = params.get("client");
  // Cherché parmi tous les clients : le panneau reste ouvert quand l'étape change, même si le client quitte la liste
  const current = open === NEW_CLIENT ? NEW_CLIENT : (pro.data.clients || []).find((c) => c.id === open) || null;
  const close = () => router.push("/pro/clients", { scroll: false });
  const openClient = (id) => router.push(`/pro/clients?client=${id}`, { scroll: false });

  return (
    <div className={`p-clients${current ? " is-open" : ""}`}>
      {/* En-tête comme Mon profil : le titre seul, puis les onglets, puis les outils de la page */}
      <h1 className="p-h1 is-page">Clients.</h1>
      <ProSubnav items={PRO_CLIENTS_TABS} label="Sections de Clients" />
      <div className="p-clients-tools">
        <div className="p-search">
          <ProIcon name="search" size={16} stroke="#6b6a63" />
          <label htmlFor="q" className="p-sr">
            Rechercher un client
          </label>
          <input id="q" type="search" className="p-input" placeholder="Rechercher un client" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="p-btn p-btn-primary p-phone-wide" onClick={() => openClient(NEW_CLIENT)}>
          <ProIcon name="plus" size={16} stroke="#ffffff" sw={2} />
          Ajouter un client
        </button>
      </div>

      <div role="group" aria-label="Filtrer par étape" className="p-pills is-scroll">
        <button type="button" aria-pressed={stage === "toutes"} className={`p-pill is-filter${stage === "toutes" ? " is-on" : ""}`} onClick={() => setStage("toutes")}>
          Toutes
        </button>
        {ACTIVE_STAGES.filter((s) => s.key !== "nouvelle" || all.some((c) => c.stage === "nouvelle")).map((s) => (
          <button key={s.key} type="button" aria-pressed={stage === s.key} className={`p-pill is-filter${stage === s.key ? " is-on" : ""}`} onClick={() => setStage(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {shown.length ? (
        <ul aria-label="Clients" className="p-dem-items">
          {shown.map((c) => {
            const on = current && current !== NEW_CLIENT && current.id === c.id;
            const stageLabel = STAGES.find((s) => s.key === c.stage)?.label;
            return (
              <li key={c.id}>
                <button type="button" aria-current={on ? "true" : undefined} className={`p-dem-item${on ? " is-on" : ""}`} onClick={() => openClient(c.id)}>
                  <span aria-hidden="true" className="p-dot is-empty" />
                  <Face names={c.names} size={40} />
                  <span className="p-dem-text">
                    <span className="p-dem-line">
                      <span className="p-dem-name">{c.names}</span>
                      {c.source === "hors_merry" ? <span className="p-chip is-small">Hors Merry</span> : null}
                    </span>
                    <span className="p-dem-meta">{[weddingWhen(c, { short: true }), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                    <span className="p-dem-line">
                      <span className="p-dem-budget">{stageLabel}</span>
                      {c.next_action ? (
                        <span className="p-dem-done">
                          {c.next_action}
                          {c.next_action_on ? ` · ${dayShort(c.next_action_on)}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-empty-line">{all.length ? "Aucun client dans ce filtre." : "Aucun client pour l’instant."}</p>
      )}

      {current ? (
        <ClientPanel
          key={current === NEW_CLIENT ? NEW_CLIENT : current.id}
          c={current === NEW_CLIENT ? null : current}
          write={params.get("ecrire") === "1"}
          onClose={close}
          onCreated={(id) => router.replace(`/pro/clients?client=${id}`, { scroll: false })}
          backLabel="Réservations"
        />
      ) : null}
    </div>
  );
}
