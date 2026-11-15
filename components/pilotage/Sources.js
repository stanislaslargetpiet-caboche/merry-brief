"use client";

// Onglet « Site » du pilotage, sous les robots : d'où viennent les visites (domaine qui a renvoyé vers le site,
// ou accès direct), par nombre de sessions sur la période. Données déjà relevées par PostHog
// (lib/server/pilotage/posthog.js, site_referrers) mais jusqu'ici jamais affichées.
import { Card, Table } from "@/components/pilotage/ui";

export default function Sources({ sources }) {
  const total = (sources || []).reduce((s, r) => s + (r.n || 0), 0);
  return (
    <Card title="Sources" note="Domaine qui a renvoyé vers le site (ou accès direct), par nombre de sessions sur la période.">
      <Table
        rows={sources}
        empty="Aucune source relevée sur la période"
        cols={[
          { key: "source", label: "Source" },
          { key: "n", label: "Sessions", num: true },
          { key: "pct", label: "Part", num: true, render: (r) => (total ? `${Math.round((r.n / total) * 100)} %` : "—") },
        ]}
      />
    </Card>
  );
}
