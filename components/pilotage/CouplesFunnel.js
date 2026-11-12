"use client";

// Page « Couples › Funnel » du pilotage : l'entonnoir des couples (lib/pilotage/funnel.js), puis un mariage par
// ligne avec son étape et ce qui le rend peut-être hors sujet. Un clic sur une étape ne garde que les couples arrêtés
// là. Mêmes données que Par couple (clé `utilisateurs` de /api/interne/pilotage).

import { useMemo, useState } from "react";
import { Card, Funnel, Pill, Section, Table } from "@/components/pilotage/ui";
import { coupleCell, fmtDay, visiteCell } from "@/components/pilotage/Utilisateurs";
import { ETAPES, buildFunnel } from "@/lib/pilotage/funnel";
import { fmtInt } from "@/lib/server/pilotage/shape";

const muted = (text) => <span className="pl-muted">{text}</span>;
const num = (n) => (n ? fmtInt(n) : muted("0"));

const stadeCell = (r) => (
  <span title={ETAPES[r.stade].detail}>
    <Pill>{ETAPES[r.stade].pastille}</Pill>
  </span>
);

function signauxCell(r) {
  if (!r.signaux.length) return muted("–");
  return (
    <span className="pl-people">
      {r.signaux.map((s) => (
        <span key={s.id} title={s.title}>
          <Pill tone={s.tone}>{s.label}</Pill>
        </span>
      ))}
    </span>
  );
}

export default function CouplesFunnel({ data }) {
  const [choix, setChoix] = useState(null);
  const { etapes, lignes } = useMemo(() => buildFunnel(data?.mariages || []), [data]);
  if (!data) {
    return (
      <Section id="funnel">
        <div className="pl-empty">Utilisateurs non lus : voir la page Santé.</div>
      </Section>
    );
  }
  const rows = choix === null ? lignes : lignes.filter((m) => m.stade === choix);
  const titre = choix === null ? `${fmtInt(etapes[0].n)} couples` : `Arrêtés à « ${etapes[choix].label} » : ${fmtInt(etapes[choix].ici)}`;
  return (
    <Section id="funnel">
      <Card>
        <Funnel steps={etapes} selected={choix} onSelect={(i) => setChoix(choix === i ? null : i)} empty="Aucun couple" />
      </Card>
      <Card>
        <div className="pl-funnel-head">
          <h3>{titre}</h3>
          {choix !== null ? (
            <button type="button" className="pl-chip" onClick={() => setChoix(null)}>
              Tout voir
            </button>
          ) : null}
        </div>
        <Table
          cols={[
            { key: "couple", label: "Couple", render: coupleCell },
            { key: "stade", label: "Étape", render: stadeCell },
            { key: "cree", label: "Inscrit", render: (r) => (r.cree ? fmtDay(r.cree) : "–") },
            { key: "visite", label: "Dernière visite", render: visiteCell },
            { key: "invites", group: "Avancement", label: "Invités", num: true, render: (r) => num(r.invites) },
            { key: "reponses", group: "Avancement", label: "Réponses", num: true, render: (r) => num(r.reponses_formulaire) },
            { key: "equipe", group: "Avancement", label: "Équipe", num: true, render: (r) => num(r.equipe) },
            { key: "budget", group: "Avancement", label: "Budget", render: (r) => (r.budget_touche ? "commencé" : muted("–")) },
            { key: "devis", group: "Avancement", label: "Devis", num: true, render: (r) => num(r.devis) },
            { key: "signaux", label: "À regarder", render: signauxCell },
          ]}
          rows={rows}
          rowClass={(r) => (r.test ? "is-test" : null)}
          max={300}
          empty="Aucun couple à cette étape"
        />
      </Card>
    </Section>
  );
}
