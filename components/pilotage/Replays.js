"use client";

// Section Santé du pilotage, sous la tuile « Bugs vus en replay » : ce que le lecteur automatique de PostHog
// (« Bugs visibles ») a constaté dans chaque session signalée, avec le replay ouvert au moment du constat. Sans ce
// tableau, l'alerte du fil (« 7 session(s) avec un bug vu dans le replay ») renvoyait à une page qui n'affichait
// que le total. Les constats sont lus par lib/server/pilotage/posthog.js (15 plus marquants de la période).
import { Card, Table } from "@/components/pilotage/ui";
import { fmtDateTime } from "@/lib/server/pilotage/shape";

export default function Replays({ replays }) {
  return (
    <Card title="Bugs vus en replay, les constats" note="Ce que le lecteur automatique de PostHog a vu dans chaque session signalée, les plus marquants d'abord ; « Replay » ouvre la session au moment du constat. Un constat peut se tromper : le replay fait foi.">
      <Table
        rows={replays?.liste || []}
        empty="Aucun bug vu dans les replays sur la période"
        cols={[
          { key: "quand", label: "Quand", render: (r) => fmtDateTime(r.quand) },
          { key: "raison", label: "Constat" },
          {
            key: "lien",
            label: "Replay",
            render: (r) =>
              r.lien ? (
                <a href={r.lien} target="_blank" rel="noreferrer">
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
