"use client";

// Onglet « Site » du pilotage, sous les visites humaines : les robots qui ont ouvert le site sur la période, par famille
// (agents IA relevés par bot_hit, autres robots par robot_hit : middleware.js). Un User-Agent se falsifie : c'est ce que
// le robot déclare être.
import { Card, Table } from "@/components/pilotage/ui";
import { fmtDateTime } from "@/lib/server/pilotage/shape";

export default function Robots({ familles }) {
  return (
    <Card title="Robots" note="Passages relevés sur le site, hors visites humaines. Les robots autres que les agents IA sont relevés depuis le 11 nov. 2026.">
      <Table
        rows={familles}
        empty="Aucun robot sur la période"
        cols={[
          { key: "famille", label: "Robot" },
          { key: "categorie", label: "Type" },
          { key: "n", label: "Passages", num: true },
          { key: "pages", label: "Pages", num: true },
          { key: "dernier", label: "Dernier passage", render: (r) => fmtDateTime(r.dernier) },
        ]}
      />
    </Card>
  );
}
