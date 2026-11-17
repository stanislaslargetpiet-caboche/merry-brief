"use client";

// Section Santé du pilotage, sous la tuile « Erreurs JavaScript » : les dernières erreurs avec leur message, leur
// page et leur replay, pour que l'alerte du fil (« 16 erreur(s) JavaScript sur 7 jours ») dise quoi corriger
// plutôt qu'un total. Les erreurs sont lues par lib/server/pilotage/posthog.js (40 dernières de la période).
import { Card, Table } from "@/components/pilotage/ui";
import { fmtDateTime, replayUrl } from "@/lib/server/pilotage/shape";

export default function Erreurs({ exceptions }) {
  return (
    <Card title="Erreurs JavaScript, les dernières" note="Message, page et navigateur de chaque erreur relevée dans le navigateur d'un visiteur, la plus récente d'abord ; « Replay » ouvre la session dans PostHog.">
      <Table
        rows={exceptions}
        empty="Aucune erreur JavaScript sur la période"
        cols={[
          { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
          { key: "titre", label: "Erreur" },
          { key: "chemin", label: "Page", render: (r) => [r.hote, r.chemin].filter(Boolean).join("") },
          { key: "navigateur", label: "Navigateur", render: (r) => [r.navigateur, r.appareil].filter(Boolean).join(" · ") },
          {
            key: "session",
            label: "Replay",
            render: (r) =>
              r.session ? (
                <a href={replayUrl(r.session)} target="_blank" rel="noreferrer">
                  Replay
                </a>
              ) : (
                ""
              ),
          },
        ]}
      />
    </Card>
  );
}
