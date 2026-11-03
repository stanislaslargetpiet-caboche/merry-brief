"use client";

// La règle de répartition (artboards 2b2, 2b3, 2b4) : le couple choisit comment se partager les dépenses,
// en pourcentage (une jauge, un curseur par personne), en montant fixe (« je mets 5 000 € »)
// ou par poste (« je prends tout le traiteur »). La jauge du haut montre le résultat en direct.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { paidByPayer } from "@/lib/dash/model";
import { MODES, guestProrataDetail, guestProrataShares, paidPostes, prorataOptions, rebalance, ruleOf, sharesOf, targetsOf } from "@/lib/dash/partage";
import { euros, parseAmount } from "@/lib/dash/format";
import { pastel } from "@/lib/dash/theme";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Avatar, Btn } from "@/components/dash/ui";
import RuleGauge from "@/components/dash/RuleGauge";

export default function Regle() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const byPayer = paidByPayer(data);
  const ids = byPayer.map((x) => x.member.id);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const saved = ruleOf(data);
  const [mode, setMode] = useState(saved.mode);
  const [shares, setShares] = useState(() => sharesOf(saved, byPayer));
  const [fixed, setFixed] = useState(() => Object.fromEntries(ids.map((id) => [id, saved.fixed[id] ? String(saved.fixed[id]) : ""])));
  const [postes, setPostes] = useState(saved.postes);
  // Le détail (prorata ou qui le prend) ne s'affiche qu'une fois « Partagé » ou « Pris en charge » cliqué
  const [openPostes, setOpenPostes] = useState(() => new Set());
  const postesPaid = paidPostes(data);
  const prorata = prorataOptions(data);

  const draft = { mode, shares, fixed: Object.fromEntries(ids.map((id) => [id, parseAmount(fixed[id]) || 0])), postes };
  const targets = targetsOf(draft, data, byPayer);
  const fixedSum = ids.reduce((a, id) => a + (parseAmount(fixed[id]) || 0), 0);
  const guestShares = guestProrataShares(data, byPayer, "tous");
  const guestDetail = guestProrataDetail(data, "tous");

  async function save() {
    await dash.saveLayout("partage", draft);
    dash.setToast({ kind: "ok", text: "La règle de répartition est enregistrée." });
    router.push("/dashboard/budget/repartition");
  }

  return (
    <>
      <div className="d-pr-backrow">
        <Link href="/dashboard/budget/repartition" className="d-pr-back">
          <Icon name="back" size={16} sw={2} />
          Répartition
        </Link>
      </div>
      <h1 className="d-title">La règle de répartition.</h1>

      <nav className="d-pr-seg d-rule-modes" aria-label="Façon de répartir">
        {MODES.map((m) => (
          <button key={m.key} type="button" className={mode === m.key ? "is-on" : ""} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className="d-card d-rule">
        <RuleGauge byPayer={byPayer} targets={targets} total={total} />

        {mode === "pct" ? (
          <ul className="d-rule-list">
            {byPayer.map((x) => (
              <li key={x.member.id}>
                <Avatar member={x.member} size={28} />
                <span className="d-rule-name">{x.member.display_name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={shares[x.member.id] || 0}
                  aria-label={`Part de ${x.member.display_name}`}
                  style={{ "--rule-color": pastel(x.member.color).mid, "--rule-pct": `${shares[x.member.id] || 0}%` }}
                  onChange={(e) => setShares((s) => rebalance(s, ids, x.member.id, Number(e.target.value)))}
                />
                <span className="d-rule-pct">
                  <span className="d-rule-pct-edit">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="d-rule-pct-input"
                      value={shares[x.member.id] || 0}
                      aria-label={`Part de ${x.member.display_name} en %`}
                      onChange={(e) => setShares((s) => rebalance(s, ids, x.member.id, Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)))))}
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                  <small>{euros(targets[x.member.id])}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {mode === "fixe" ? (
          <>
            <ul className="d-rule-list is-fixed">
              {byPayer.map((x) => (
                <li key={x.member.id}>
                  <Avatar member={x.member} size={28} />
                  <span className="d-rule-name">{x.member.display_name}</span>
                  <label className="d-rule-amount">
                    <input className="d-input" inputMode="decimal" placeholder="Le reste" value={fixed[x.member.id]} onChange={(e) => setFixed((f) => ({ ...f, [x.member.id]: e.target.value }))} aria-label={`Montant pris en charge par ${x.member.display_name}`} />
                    <span>€</span>
                  </label>
                  <span className="d-rule-pct">
                    <strong>{euros(targets[x.member.id])}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <p className="d-rule-rest">
              {fixedSum >= total ? (
                <>Les montants fixes couvrent les {euros(total)} dépensés.</>
              ) : (
                <>
                  Reste <strong>{euros(total - fixedSum)}</strong>, partagé à parts égales entre ceux qui n'ont pas de montant fixe.
                </>
              )}
            </p>
          </>
        ) : null}

        {mode === "poste" ? (
          postesPaid.length ? (
            <ul className="d-rule-postes">
              {postesPaid.map((g) => {
                const who = postes[g.key] || "partage";
                const takenBy = byPayer.some((x) => x.member.id === who) ? who : null;
                const shared = !takenBy;
                return (
                  <li key={g.key}>
                    <div className="d-rule-poste">
                      <Tile name={g.icon || guessIcon(g.label)} size={32} />
                      <strong>{g.name}</strong>
                      <span>{euros(g.paid)}</span>
                    </div>
                    <div className="d-filters" role="radiogroup" aria-label={`Comment partager ${g.name}`}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={shared}
                        className={`d-pill${shared ? " is-on" : ""}`}
                        style={shared ? { background: pastel("sauge").bg, borderColor: pastel("sauge").ink, color: pastel("sauge").ink } : undefined}
                        onClick={() => {
                          setPostes((p) => ({ ...p, [g.key]: "partage" }));
                          setOpenPostes((s) => new Set(s).add(g.key));
                        }}
                      >
                        Partagé
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!shared}
                        className={`d-pill${!shared ? " is-on" : ""}`}
                        style={!shared ? { background: pastel("peche").bg, borderColor: pastel("peche").ink, color: pastel("peche").ink } : undefined}
                        onClick={() => {
                          setPostes((p) => ({ ...p, [g.key]: byPayer[0]?.member.id || "partage" }));
                          setOpenPostes((s) => new Set(s).add(g.key));
                        }}
                      >
                        Pris en charge par quelqu'un
                      </button>
                    </div>
                    {openPostes.has(g.key) ? (
                    <div className="d-rule-poste-detail">
                      {shared ? (
                        <div className="d-filters is-sub" role="radiogroup" aria-label={`Au prorata de quoi pour ${g.name}`}>
                          <button type="button" role="radio" aria-checked={who === "partage"} className={`d-pill is-small${who === "partage" ? " is-on" : ""}`} onClick={() => setPostes((p) => ({ ...p, [g.key]: "partage" }))}>
                            Parts égales
                          </button>
                          {prorata.map((opt) => (
                            <button key={opt.key} type="button" role="radio" aria-checked={who === opt.key} className={`d-pill is-small${who === opt.key ? " is-on" : ""}`} onClick={() => setPostes((p) => ({ ...p, [g.key]: opt.key }))}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="d-filters is-sub" role="radiogroup" aria-label={`Qui prend ${g.name}`}>
                          {byPayer.map((x) => (
                            <button key={x.member.id} type="button" role="radio" aria-checked={who === x.member.id} className={`d-pill d-pill-person is-small${who === x.member.id ? " is-on" : ""}`} onClick={() => setPostes((p) => ({ ...p, [g.key]: x.member.id }))}>
                              <Avatar member={x.member} size={18} />
                              {x.member.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {who && who.startsWith("invites:")
                        ? (() => {
                            const shares = guestProrataShares(data, byPayer, who.slice("invites:".length));
                            return (
                              <div className="d-rule-prorata-chips">
                                {byPayer
                                  .filter((x) => shares[x.member.id])
                                  .map((x) => (
                                    <span key={x.member.id}>
                                      <strong>{Math.round(shares[x.member.id] || 0)} %</strong>
                                      <small>{x.member.display_name}</small>
                                    </span>
                                  ))}
                              </div>
                            );
                          })()
                        : null}
                    </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="d-rule-rest">Aucune dépense payée pour l'instant.</p>
          )
        ) : null}

        {mode === "invites" ? (
          <>
            {guestDetail && guestDetail.total ? (
              <div className="d-rule-guests">
                {guestDetail.sides.map((s) => (
                  <span key={s.member.id}>
                    <strong>{s.count}</strong>
                    <small>invités côté {s.member.display_name}</small>
                  </span>
                ))}
              </div>
            ) : null}
            <ul className="d-rule-list is-readonly">
              {byPayer.map((x) => (
                <li key={x.member.id}>
                  <Avatar member={x.member} size={28} />
                  <span className="d-rule-name">{x.member.display_name}</span>
                  <span className="d-rule-pct">
                    <strong>{Math.round(guestShares[x.member.id] || 0)} %</strong>
                    <small>{euros(targets[x.member.id])}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="d-rule-rest">Calculé selon la part des invités de chaque côté dans la liste, mise à jour automatiquement.</p>
          </>
        ) : null}
      </div>

      <div className="d-rule-actions">
        <Btn onClick={save}>Enregistrer la règle</Btn>
      </div>
    </>
  );
}
