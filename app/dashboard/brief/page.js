"use client";

import { useData } from "@/lib/dash/store";
import { longDate } from "@/lib/dash/format";
import { PageHeader } from "@/components/dash/ui";

const LABELS = {
  stage: { debut: "Au tout début", regarde: "On commence à s'y pencher", lieu_recherche: "Recherche du lieu", lieu_reserve: "Lieu réservé", details: "Derniers détails" },
  team: { nous_deux: "Juste vous deux", nous_parents: "Vous et vos parents", nous_planner: "Vous et un wedding planner", planner_seul: "Un wedding planner" },
  guests: { "<50": "Moins de 50 invités", "50-100": "50 à 100 invités", "100-150": "100 à 150 invités", "150-200": "150 à 200 invités", ">200": "Plus de 200 invités" },
  budget: { "<15k": "Moins de 15 000 €", "15-30k": "15 000 à 30 000 €", "30-50k": "30 000 à 50 000 €", ">50k": "Plus de 50 000 €", aucune_idee: "Budget à définir" },
  format: { jour: "Une journée", weekend: "Un week-end", inconnu: "Pas encore décidé" },
};

export default function BriefPage() {
  const data = useData();
  const b = data.brief;
  const rows = b
    ? [
        ["Où vous en êtes", LABELS.stage[b.stage] || b.stage],
        ["Qui organise", LABELS.team[b.team] || b.team],
        ["Date", b.wedding_date ? longDate(b.wedding_date) : "À définir"],
        ["Région", b.region || "À définir"],
        ["Invités", LABELS.guests[b.guests] || b.guests],
        ["Format", LABELS.format[b.format] || b.format],
        ["Budget", LABELS.budget[b.budget] || b.budget],
        ["Style", (b.vibes || []).join(", ") || "–"],
      ]
    : [];

  return (
    <>
      <PageHeader back={{ href: "/dashboard", label: "Accueil" }} title="Votre brief." />
      {b ? (
        <section className="d-card" style={{ maxWidth: 720 }}>
          {rows.map(([k, v]) => (
            <div key={k} className="d-contact-row">
              <div>
                <small>{k}</small>
                <span>{v}</span>
              </div>
            </div>
          ))}
          <p className="d-small d-muted" style={{ margin: 0 }}>
            Le brief sert de point de départ : la date, le lieu et le budget se modifient depuis l'accueil, en cliquant sur la date.
          </p>
        </section>
      ) : (
        <div className="d-empty">
          <p>Pas de brief pour ce mariage. Dix minutes de questions suffisent pour que Merry prépare tout.</p>
          <a className="d-btn d-btn-primary" href="/">
            Remplir le brief
          </a>
        </div>
      )}
    </>
  );
}
