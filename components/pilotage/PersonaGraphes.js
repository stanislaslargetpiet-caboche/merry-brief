"use client";

// Graphes de la page Acquisition › Persona (D-398, puis D-399 : camemberts et barres à la place des tableaux).
// Deux teintes pistache vérifiées au validateur de palette (daltonisme compris) : foncée pour les clics Google Ads,
// claire pour les inscrits ; chaque part est écrite à côté de sa marque, la couleur ne porte jamais seule le sens.
// Les « Inconnu » ne sont pas dessinés : leur nombre est écrit sous le graphe.
import { fmtInt } from "@/lib/server/pilotage/shape";

export const TEINTES = { clics: "#4a7f2c", inscrits: "#8cc56a" };
const SEXE = { Femme: TEINTES.clics, Homme: TEINTES.inscrits };

const pct = (v) => (v === null || v === undefined ? "–" : `${v} %`);

// Arc d'anneau de a0 à a1 (en tours, 0 en haut, sens horaire)
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a * 2 * Math.PI), cy - r * Math.cos(a * 2 * Math.PI)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0}A${r},${r} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1},${y1}`;
}

/** Anneau : `parts` [{ label, n, part, couleur }], le grand chiffre au centre */
export function Anneau({ titre, parts, centre, sousCentre, inconnus, unite }) {
  const connues = parts.filter((p) => p.n > 0);
  const total = connues.reduce((a, p) => a + p.n, 0);
  const S = 148;
  const r = 58;
  const ecart = connues.length > 1 ? 0.006 : 0;
  let a = 0;
  return (
    <figure className="pl-anneau">
      {titre ? <figcaption>{titre}</figcaption> : null}
      {total ? (
        <div className="pl-anneau-corps">
          <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${titre || ""} : ${connues.map((p) => `${p.label} ${pct(p.part)}`).join(", ")}`}>
            <circle cx={S / 2} cy={S / 2} r={r} className="pl-anneau-fond" />
            {connues.map((p) => {
              const a0 = a;
              a += p.n / total;
              const d = connues.length === 1 ? null : arc(S / 2, S / 2, r, a0 + ecart, a - ecart);
              return d ? (
                <path key={p.label} d={d} stroke={p.couleur} className="pl-anneau-arc">
                  <title>{`${p.label} : ${fmtInt(p.n)} ${unite} (${pct(p.part)})`}</title>
                </path>
              ) : (
                <circle key={p.label} cx={S / 2} cy={S / 2} r={r} stroke={p.couleur} className="pl-anneau-arc">
                  <title>{`${p.label} : ${fmtInt(p.n)} ${unite} (${pct(p.part)})`}</title>
                </circle>
              );
            })}
            <text x={S / 2} y={S / 2 + 4} textAnchor="middle" className="pl-anneau-centre">{centre}</text>
            {sousCentre ? <text x={S / 2} y={S / 2 + 22} textAnchor="middle" className="pl-anneau-sous">{sousCentre}</text> : null}
          </svg>
          <ul className="pl-legende">
            {connues.map((p) => (
              <li key={p.label}>
                <i style={{ background: p.couleur }} />
                <span>{p.label}</span>
                <strong>{pct(p.part)}</strong>
                <small>{fmtInt(p.n)}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="pl-empty">Rien sur la période</div>
      )}
      {inconnus ? <p className="pl-note">{fmtInt(inconnus)} {unite} sans sexe connu</p> : null}
    </figure>
  );
}

/** Sexe : un anneau pour les clics, un pour les inscrits */
export function AnneauxSexe({ rows }) {
  const lire = (cle, part) => rows.filter((r) => !r.inconnu).map((r) => ({ label: r.label, n: r[cle], part: r[part], couleur: SEXE[r.label] || TEINTES.inscrits }));
  const inconnu = rows.find((r) => r.inconnu);
  const femmes = (cle) => rows.find((r) => r.label === "Femme")?.[cle];
  const anneau = (titre, cle, part, unite) => {
    const parts = lire(cle, part);
    const f = femmes(part);
    return <Anneau titre={titre} parts={parts} centre={f === null || f === undefined ? "–" : `${f} %`} sousCentre="de femmes" inconnus={inconnu?.[cle] || 0} unite={unite} />;
  };
  return (
    <div className="pl-anneaux">
      {anneau("Clics Google Ads", "clics", "part_clics", "clics")}
      {anneau("Inscrits", "inscriptions", "part_inscriptions", "inscrits")}
    </div>
  );
}

/** Colonnes d'une répartition ordonnée (âge) : une teinte, la part écrite au-dessus de chaque colonne */
export function Colonnes({ rows }) {
  const vus = rows.filter((r) => !r.inconnu && r.clics > 0);
  const inconnu = rows.find((r) => r.inconnu);
  if (!vus.length) return <div className="pl-empty">Rien sur la période</div>;
  const max = Math.max(...vus.map((r) => r.part_clics || 0), 1);
  return (
    <>
      <div className="pl-colonnes" role="img" aria-label={vus.map((r) => `${r.label} ${pct(r.part_clics)}`).join(", ")}>
        {vus.map((r) => (
          <div key={r.label} className="pl-colonne" title={`${r.label} : ${fmtInt(r.clics)} clics (${pct(r.part_clics)})`}>
            <strong>{pct(r.part_clics)}</strong>
            <span className="pl-colonne-piste">
              <span style={{ height: `${((r.part_clics || 0) / max) * 100}%`, background: TEINTES.clics }} />
            </span>
            <small>{r.label.replace(" ans", "").replace(" et plus", "+")}</small>
          </div>
        ))}
      </div>
      <p className="pl-note">En années. {inconnu?.clics ? `${fmtInt(inconnu.clics)} clics d'âge inconnu.` : ""}</p>
    </>
  );
}

/** Barres horizontales : clics et, si `inscrits`, inscrits sous chaque libellé ; la plus grande part donne l'échelle */
export function Barres({ rows, inscrits = true, max: maxLignes = 13 }) {
  const vus = rows.filter((r) => !r.inconnu && (r.clics > 0 || (inscrits && r.inscriptions > 0))).slice(0, maxLignes);
  const inconnu = rows.find((r) => r.inconnu);
  if (!vus.length) return <div className="pl-empty">Rien sur la période</div>;
  const max = Math.max(1, ...vus.flatMap((r) => [r.part_clics || 0, inscrits ? r.part_inscriptions || 0 : 0]));
  const barre = (part, n, couleur, unite) => (
    <span className="pl-barre" title={`${fmtInt(n)} ${unite} (${pct(part)})`}>
      <span className="pl-barre-piste">
        <span style={{ width: `${((part || 0) / max) * 100}%`, background: couleur }} />
      </span>
      <em>{pct(part)}</em>
    </span>
  );
  const reste = [inconnu?.clics ? `${fmtInt(inconnu.clics)} clics` : null, inscrits && inconnu?.inscriptions ? `${fmtInt(inconnu.inscriptions)} inscrits` : null].filter(Boolean);
  return (
    <>
      {inscrits ? (
        <div className="pl-legende-ligne">
          <span><i style={{ background: TEINTES.clics }} />Clics Google Ads</span>
          <span><i style={{ background: TEINTES.inscrits }} />Inscrits</span>
        </div>
      ) : null}
      <ul className="pl-barres">
        {vus.map((r) => (
          <li key={r.label}>
            <span className="pl-barres-label">{r.label}</span>
            <span className="pl-barres-valeurs">
              {barre(r.part_clics, r.clics, TEINTES.clics, "clics")}
              {inscrits ? barre(r.part_inscriptions, r.inscriptions, TEINTES.inscrits, "inscrits") : null}
            </span>
          </li>
        ))}
      </ul>
      {reste.length ? <p className="pl-note">Sans lieu connu : {reste.join(", ")}.</p> : null}
    </>
  );
}
