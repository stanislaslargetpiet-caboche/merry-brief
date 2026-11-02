"use client";

// Foyers : les foyers déjà formés (membres, adresse), et les regroupements que Merry propose
// (même nom de famille, même groupe, adresses compatibles), à accepter d'un clic ou un par un.

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { fullName, uid } from "@/lib/dash/format";
import { householdAddress, householdLabel, householdsOf, suggestHouseholds } from "@/lib/dash/households";
import { Icon } from "./icons";
import { Btn, Modal } from "./ui";

export default function HouseholdsModal({ onClose, onGroup }) {
  const dash = useDash();
  const { guests } = dash.data;
  const setup = dash.data.relancesSetup !== false;
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const households = useMemo(() => [...householdsOf(guests, byId).values()].filter((m) => m.length > 1), [guests, byId]);
  const suggestions = useMemo(() => suggestHouseholds(guests, byId), [guests, byId]);
  const [hidden, setHidden] = useState(new Set()); // propositions écartées (cette fois)
  const shown = suggestions.filter((m) => !hidden.has(m[0].id));

  const accept = async (members) => onGroup(members.map((g) => g.id), uid());

  return (
    <Modal
      title="Foyers"
      onClose={onClose}
      footer={
        <>
          <span className="d-small d-muted">Un foyer = un faire-part, une adresse. Pour en former un à la main : cochez des invités, puis « Même foyer ».</span>
          <span className="d-spacer" />
          <Btn onClick={onClose}>Fermer</Btn>
        </>
      }
    >
      <div className="d-col" style={{ gap: 18 }}>
        {!setup ? (
          <p className="d-small" style={{ margin: 0, padding: 12, borderRadius: 12, background: "#fff4e5" }}>
            Pour garder les foyers, lancez <code>supabase/relances-et-foyers.sql</code> dans Supabase (SQL Editor).
          </p>
        ) : null}
        {shown.length ? (
          <div className="d-gfilter">
            <div className="d-gfilter-head">
              <strong>
                {shown.length} regroupement{shown.length > 1 ? "s" : ""} proposé{shown.length > 1 ? "s" : ""}
              </strong>
              <button
                type="button"
                className="d-link"
                disabled={!setup}
                onClick={async () => {
                  for (const m of shown) await accept(m);
                }}
              >
                Tout accepter
              </button>
            </div>
            <ul className="d-moments">
              {shown.map((m) => (
                <li key={m[0].id} className="d-moment">
                  <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{householdLabel(m)}</span>
                    <small className="d-muted">
                      {m.map((g) => fullName(g) || "+1 à nommer").join(", ")}
                      {householdAddress(m) ? ` · ${householdAddress(m)}` : ""}
                    </small>
                  </span>
                  <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Btn small disabled={!setup} onClick={() => accept(m)}>
                      Regrouper
                    </Btn>
                    <button type="button" className="d-icon-btn" aria-label="Écarter cette proposition" title="Pas un foyer" onClick={() => setHidden((h) => new Set([...h, m[0].id]))}>
                      <Icon name="x" size={14} sw={2.2} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="d-gfilter">
          <div className="d-gfilter-head">
            <strong>
              {households.length} foyer{households.length > 1 ? "s" : ""} de plusieurs personnes
            </strong>
          </div>
          {households.length ? (
            <ul className="d-moments">
              {households.map((m) => (
                <li key={m[0].household_id || m[0].id} className="d-moment">
                  <span style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{householdLabel(m)}</span>
                    <small className="d-muted">
                      {m.map((g) => fullName(g) || "+1 à nommer").join(", ")}
                      {householdAddress(m) ? ` · ${householdAddress(m)}` : " · adresse manquante"}
                    </small>
                  </span>
                  <span style={{ flex: "none" }}>
                    {m[0].household_id ? (
                      <button type="button" className="d-link d-small" onClick={() => onGroup(m.map((g) => g.id), null)}>
                        Défaire
                      </button>
                    ) : (
                      <small className="d-muted">accompagnants</small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="d-small d-muted" style={{ margin: 0 }}>
              Pas encore de foyer. {shown.length ? "Acceptez une proposition ci-dessus, ou cochez des invités dans le tableau." : "Cochez des invités dans le tableau, puis « Même foyer »."}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
