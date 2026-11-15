"use client";

// Section Santé du pilotage, sous la tuile « Clics de rage » : où ces clics sont tombés, pour que l'alerte du fil
// (« une personne a cliqué plusieurs fois au même endroit sans effet ») mène à une page précise plutôt qu'à un total.
import { Card, Table } from "@/components/pilotage/ui";
import { fmtDateTime } from "@/lib/server/pilotage/shape";

export default function Rage({ rage }) {
  return (
    <Card title="Clics de rage, par page" note="Pages où quelqu'un a cliqué plusieurs fois de suite au même endroit sans effet visible, les plus touchées d'abord.">
      <Table
        rows={rage}
        empty="Aucun clic de rage sur la période"
        cols={[
          { key: "chemin", label: "Page" },
          { key: "hote", label: "Site" },
          { key: "n", label: "Clics", num: true },
          { key: "dernier", label: "Dernier clic", render: (r) => fmtDateTime(r.dernier) },
        ]}
      />
    </Card>
  );
}
