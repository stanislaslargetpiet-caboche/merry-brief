"use client";

// Espace « Budget » (artboards 2a, 2b et 2e, ordinateur et téléphone) : le titre et trois onglets,
// les dépenses, la répartition entre organisateurs, puis les documents.
// Même en-tête que l'espace Invités ; « actions » reste à droite du titre, comme PageHeader.

import Link from "next/link";
import { PageHeader } from "./ui";

const TABS = [
  { id: "depenses", href: "/dashboard/budget", label: "Dépenses" },
  { id: "repartition", href: "/dashboard/budget/repartition", label: "Répartition" },
  { id: "documents", href: "/dashboard/documents", label: "Documents" },
];

export default function BudgetHeader({ tab, actions }) {
  return (
    <div className="d-itabs-head">
      <PageHeader title="Budget." actions={actions} />
      <nav className="d-itabs" aria-label="Votre budget">
        {TABS.map((t) => (
          <Link key={t.id} href={t.href} className={`d-itab${t.id === tab ? " is-on" : ""}`} aria-current={t.id === tab ? "page" : undefined}>
            <span className="d-itab-long">{t.label}</span>
            <span className="d-itab-short">{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
