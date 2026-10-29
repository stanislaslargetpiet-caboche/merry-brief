"use client";

// Espace « Invités » (artboards « 10 · Invités, un seul espace », ordinateur et téléphone) : le titre et quatre onglets
// dans l'ordre du parcours du couple : la liste, le site, le formulaire, puis la liste de mariage (bientôt).
// Chaque page de l'espace commence par cet en-tête ; « actions » reste à droite du titre, comme PageHeader.

import Link from "next/link";
import { useDash } from "@/lib/dash/store";
import { PageHeader } from "./ui";

export default function InvitesHeader({ tab, actions }) {
  const data = useDash().data;
  const replies = data.form?.submissions || 0;
  const tabs = [
    { id: "liste", href: "/dashboard/invites", label: "Liste des invités", short: "Invités", extra: <span className="d-itab-count">{data.guests.length}</span> },
    {
      id: "site",
      href: "/dashboard/invites/site",
      label: "Site de mariage",
      short: "Site",
      extra: data.site ? <span className={`d-itab-online${data.site.published ? "" : " is-off"}`}>{data.site.published ? "En ligne" : "Hors ligne"}</span> : null,
    },
    { id: "formulaire", href: "/dashboard/invites/formulaire", label: "Formulaire", short: "Formulaire", extra: replies ? <span className="d-itab-count">{replies} réponse{replies > 1 ? "s" : ""}</span> : null },
    { id: "liste-de-mariage", soon: true, label: "Liste de mariage", short: "Liste de mariage", extra: <span className="d-itab-soon">Bientôt !</span> },
  ];
  return (
    <div className="d-itabs-head">
      <PageHeader title="Invités." actions={actions} />
      <nav className="d-itabs" aria-label="Vos invités">
        {tabs.map((t) =>
          // Pas encore ouvert : l'onglet se voit, grisé, sans mener nulle part
          t.soon ? (
            <span key={t.id} className="d-itab is-soon" aria-disabled="true" aria-label={`${t.label}, bientôt`}>
              <span className="d-itab-long">{t.label}</span>
              <span className="d-itab-short">{t.short}</span>
              {t.extra}
            </span>
          ) : (
            <Link key={t.id} href={t.href} className={`d-itab${t.id === tab ? " is-on" : ""}`} aria-current={t.id === tab ? "page" : undefined} aria-label={t.label}>
              <span className="d-itab-long">{t.label}</span>
              <span className="d-itab-short">{t.short}</span>
              {t.extra}
            </Link>
          ),
        )}
      </nav>
    </div>
  );
}
