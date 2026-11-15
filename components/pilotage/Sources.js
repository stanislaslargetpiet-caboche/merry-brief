"use client";

// Onglet « Site » du pilotage, sous les robots : d'où viennent les visites humaines (domaine qui a renvoyé vers
// le site, ou accès direct), par nombre de visites sur la période. Relevé par le compteur anonyme sans cookie
// (lib/compteur.js, en-tête Referer) : couvre toute « Visites humaines », pas seulement les visites avec cookies
// acceptés (PostHog, trop restreint pour ce tableau).
import { Card, Table } from "@/components/pilotage/ui";

export default function Sources({ sources }) {
  const total = (sources || []).reduce((s, r) => s + (r.n || 0), 0);
  return (
    <Card title="Sources" note="Domaine qui a renvoyé vers le site (ou accès direct), par nombre de visites sur la période.">
      <Table
        rows={sources}
        empty="Aucune source relevée sur la période"
        cols={[
          { key: "source", label: "Source" },
          { key: "n", label: "Visites", num: true },
          { key: "pct", label: "Part", num: true, render: (r) => (total ? `${Math.round((r.n / total) * 100)} %` : "—") },
        ]}
      />
    </Card>
  );
}
