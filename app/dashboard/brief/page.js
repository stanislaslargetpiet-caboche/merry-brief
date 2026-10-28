"use client";

import { useState } from "react";
import { useData } from "@/lib/dash/store";
import { euros, longDate } from "@/lib/dash/format";
import { Icon, Tile } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";
import WeddingModal from "@/components/dash/WeddingModal";

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
  const w = data.wedding;
  const [edit, setEdit] = useState(false);
  // Date, lieu et budget : ce que vous avez saisi depuis (accueil), pas la réponse du brief d'origine
  const place = [w.venue, w.region].filter(Boolean).join(", ");
  const budget = w.budget_total !== null && w.budget_total !== undefined ? euros(w.budget_total) : LABELS.budget[b?.budget] || b?.budget;
  const fields = b
    ? [
        ["sparkle", "Où vous en êtes", LABELS.stage[b.stage] || b.stage],
        ["users", "Qui organise", LABELS.team[b.team] || b.team],
        ["calendar", "Date", w.wedding_date ? longDate(w.wedding_date) : "À définir"],
        ["lieu", "Lieu", place || b.region || "À définir"],
        ["table", "Invités", LABELS.guests[b.guests] || b.guests],
        ["horloge", "Format", LABELS.format[b.format] || b.format],
        ["wallet", "Budget", budget || "À définir"],
        ["tenues", "Style", (b.vibes || []).join(", ") || "–"],
      ]
    : [];

  return (
    <>
      <PageHeader back={{ href: "/dashboard/budget", label: "Budget" }} title="Brief." />
      {b ? (
        <div className="d-col" style={{ gap: 28, maxWidth: 800 }}>
          <div className="d-g2" style={{ gap: 12 }}>
            {fields.map(([icon, k, v]) => (
              <div key={k} className="d-brief-field">
                <Tile name={icon} size={36} />
                <div>
                  <small>{k}</small>
                  <span>{v}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Btn kind="ghost" small icon="pencil" onClick={() => setEdit(true)}>
              Modifier la date, le lieu, le budget
            </Btn>
            <span className="d-small d-muted">Le reste du brief est le point de départ de votre organisation.</span>
          </div>

          <div className="d-col" style={{ gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>Ce qui vous ressemble</h2>
            <div className="d-g2" style={{ gap: 12 }}>
              <div className="d-brief-answer">
                <Tile name="lit" size={44} bg="var(--d-lime)" fill="#ffffff" />
                <strong>Un week-end idéal pour vous deux ?</strong>
                <span>Partir à la montagne, cuisiner ensemble, ne rien faire sans horaire.</span>
              </div>
              <div className="d-brief-answer">
                <Tile name="adresse" size={44} bg="var(--d-lime)" fill="#ffffff" />
                <strong>Le rêve pour votre lune de miel ?</strong>
                <span>Une route de trois semaines au Japon, du temple le matin au bar à sushis le soir.</span>
              </div>
            </div>
          </div>

          <div className="d-import-banner">
            <span className="d-import-banner-icon">
              <Icon name="camera" size={24} sw={1.8} />
            </span>
            <div className="d-import-banner-text">
              <strong>Votre moodboard</strong>
              <span>Glissez vos inspirations Pinterest, Instagram ou vos photos. Merry les garde avec le reste du brief.</span>
            </div>
            <Btn icon="upload">Importer un moodboard</Btn>
          </div>
        </div>
      ) : (
        <div className="d-empty">
          <p>Pas de brief pour ce mariage. Dix minutes de questions suffisent pour que Merry prépare tout.</p>
          <a className="d-btn d-btn-primary" href="/">
            Remplir le brief
          </a>
        </div>
      )}
      {edit ? <WeddingModal onClose={() => setEdit(false)} /> : null}
    </>
  );
}
