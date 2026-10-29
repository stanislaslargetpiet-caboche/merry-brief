"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { budgetTotals, groupFinance, groupItems, itemFinance, kpiItems, lineLabel, paidByPayer, posteName } from "@/lib/dash/model";
import { euros, parseAmount, shortDate } from "@/lib/dash/format";
import { POSTE_COLORS, pastel } from "@/lib/dash/theme";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Btn, Donut, InlineEdit, KpiBar, OkPill, PersonChip, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import PosteModal from "@/components/dash/PosteModal";
import DepenseModal from "@/components/dash/DepenseModal";
import LigneModal from "@/components/dash/LigneModal";
import { DocLink } from "@/components/dash/Documents";

function Variance({ value, big }) {
  if (value === null || value === undefined) return null;
  const v = Math.round(value);
  if (v === 0)
    return (
      <span className={`d-variance is-equal${big ? " is-big" : ""}`}>
        = budget
      </span>
    );
  return (
    <span className={`d-variance ${v > 0 ? "is-over" : "is-under"}${big ? " is-big" : ""}`}>
      <Icon name={v > 0 ? "arrowUp" : "arrowDown"} size={big ? 13 : 12} sw={2.4} />
      {euros(v, { signed: true })} vs budget
    </span>
  );
}

function dueLabel(p, weddingDate) {
  if (!p) return "";
  const when = p.due_date && weddingDate && p.due_date === weddingDate ? "le jour J" : p.due_date ? `le ${shortDate(p.due_date)}` : "à planifier";
  return `${p.label} ${when}`;
}

// Une cellule qui commence par = + - @ serait lue comme une formule par Excel
function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Budget() {
  const dash = useDash();
  const data = dash.data;
  const { items, members, vendors, documents, wedding, payments, guests } = data;
  const groups = groupItems(items);
  // Pied de la colonne « Par invité » : la moyenne des postes (un poste à plusieurs lignes compte pour un), pas leur somme
  const groupValue = (g) => {
    const vals = g.items.map((it) => itemFinance(it, payments)).map((f) => f.quote ?? f.budgeted ?? null).filter((v) => v !== null);
    return vals.length ? vals.reduce((a, v) => a + v, 0) : null;
  };
  const perGuestValues = guests.length ? groups.map(groupValue).filter((v) => v !== null).map((v) => v / guests.length) : [];
  const avgPerGuest = perGuestValues.length ? perGuestValues.reduce((a, v) => a + v, 0) / perGuestValues.length : null;
  const [editing, setEditing] = useState(null); // item | "new"
  const [quoteFocus, setQuoteFocus] = useState(false);
  const [adding, setAdding] = useState(false); // fenêtre « Ajouter une dépense »
  const [lining, setLining] = useState(null); // nom du poste où l'on ajoute une ligne
  const [folded, setFolded] = useState(() => new Set()); // postes à plusieurs lignes repliés
  const toggleGroup = (key) =>
    setFolded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  // Plusieurs lignes dans un poste : demande la colonne « category » (supabase/reponses-et-lignes.sql)
  const addLine = (name) => {
    if (dash.mode === "live" && !data.categoriesSetup) {
      dash.setToast({ kind: "error", text: "Pour ajouter plusieurs lignes dans un poste, lancez supabase/reponses-et-lignes.sql dans Supabase." });
      return;
    }
    setLining(name);
  };

  const b = budgetTotals(data);
  const kpis = kpiItems(data, "budget");
  const memberById = new Map(members.map((m) => [m.id, m]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  // Répartition : qui a déjà payé quoi, et où va l'argent
  const byPayer = paidByPayer(data);
  const paying = byPayer.filter((x) => x.amount > 0);
  const signed = items.filter((i) => i.quote_amount !== null && i.quote_amount !== undefined).sort((a, z) => Number(z.quote_amount) - Number(a.quote_amount));

  function exportCsv() {
    const head = ["Poste", "Ligne", "Prestataire", "Budget", "Devis signé", "Écart", "Par invité", "Payé", "Payé par", "Prochaine échéance"];
    const rows = groups.flatMap((g) => g.items.map((it) => [g, it])).map(([g, it]) => {
      const f = itemFinance(it, payments);
      return [
        g.multi ? g.name : it.category ? it.category : it.label,
        g.multi ? lineLabel(it, g.name) : it.category ? it.label : "",
        vendorById.get(it.vendor_id)?.name || "",
        f.budgeted ?? "",
        f.quote ?? "",
        f.variance ?? "",
        guests.length ? Math.round((f.quote ?? f.budgeted ?? 0) / guests.length) : "",
        f.paid,
        f.payers.map((id) => memberById.get(id)?.display_name).filter(Boolean).join(", "),
        f.next ? `${f.next.label} ${f.next.due_date || ""} ${f.next.amount}` : "",
      ];
    });
    const text = [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = "budget-mariage.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }


  // Statut d'une ligne : on ne paie pas depuis Merry, on note les dépenses (« Ajouter une dépense »)
  const lineAction = (it, f) =>
    f.fullyPaid ? (
      <span className="d-status is-done">
        <Icon name="check" size={12} sw={2.4} />
        Tout payé
      </span>
    ) : f.next ? (
      <span className="d-status is-todo">{dueLabel(f.next, wedding.wedding_date)}</span>
    ) : f.quote !== null ? (
      <span className="d-status is-todo">Reste {euros(f.remaining)}</span>
    ) : (
      <button
        type="button"
        className="d-link"
        style={{ fontSize: 12 }}
        onClick={() => {
          setQuoteFocus(true);
          setEditing(it);
        }}
      >
        Ajouter un devis
      </button>
    );

  // Téléphone : un poste à plusieurs lignes, déplié ou replié
  const renderGroupCard = (g) => {
    const gf = groupFinance(g, payments);
    const open = !folded.has(g.key);
    return (
      <div key={g.key} className="d-pcard is-group">
        <button type="button" className="d-gtoggle" aria-expanded={open} onClick={() => toggleGroup(g.key)}>
          <Tile name={g.items[0].icon || guessIcon(g.name)} />
          <span className="d-pcard-text">
            <strong>{g.name}</strong>
            <small>
              {g.items.length} lignes{gf.paid ? ` · ${euros(gf.paid)} payés` : ""}
            </small>
          </span>
          <span className="d-pcard-amounts">
            <strong>{gf.budgeted !== null ? euros(gf.budgeted) : gf.quote !== null ? euros(gf.quote) : "–"}</strong>
            <small>{gf.quote !== null ? `dont ${euros(gf.quote)} signés` : "budget"}</small>
          </span>
          <span className={`d-gchev${open ? " is-open" : ""}`}>
            <Icon name="chev" size={16} sw={2.2} />
          </span>
        </button>
        {open ? (
          <div className="d-lines">
            {g.items.map((it) => {
              const f = itemFinance(it, payments);
              const v = vendorById.get(it.vendor_id);
              return (
                <div key={it.id} className="d-line">
                  <span className="d-line-text">
                    <button type="button" className="d-line-tag" onClick={() => setEditing(it)} title="Modifier la ligne">
                      {lineLabel(it, g.name)}
                    </button>
                    {v ? <Link href={`/dashboard/budget/prestataires/${v.id}`}>{v.name}</Link> : <small>Prestataire à choisir</small>}
                  </span>
                  <span className="d-line-amount">
                    <strong>{(f.quote ?? f.budgeted) !== null ? euros(f.quote ?? f.budgeted) : "–"}</strong>
                    {lineAction(it, f)}
                  </span>
                </div>
              );
            })}
            <button type="button" className="d-line-add" onClick={() => addLine(g.name)}>
              <Icon name="plus" size={14} sw={2.4} />
              Ajouter une ligne dans {g.name}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  // Ordinateur : la ligne de tête d'un poste à plusieurs lignes, avec les totaux de ses lignes
  const renderGroupRow = (g) => {
    const gf = groupFinance(g, payments);
    const open = !folded.has(g.key);
    const value = gf.lines.reduce((a, f) => a + (f.quote ?? f.budgeted ?? 0), 0);
    return (
      <tr key={g.key} className="d-group-row">
        <td>
          <button type="button" className="d-gtoggle" aria-expanded={open} onClick={() => toggleGroup(g.key)}>
            <Tile name={g.items[0].icon || guessIcon(g.name)} />
            <span className="d-budget-poste-text">
              <strong>{g.name}</strong>
              <small>
                {g.items.length} lignes{gf.paid ? ` · ${euros(gf.paid)} payés` : ""}
              </small>
            </span>
            <span className={`d-gchev${open ? " is-open" : ""}`}>
              <Icon name="chev" size={16} sw={2.2} />
            </span>
          </button>
        </td>
        <td className="is-num">{gf.budgeted !== null ? euros(gf.budgeted) : <span className="d-muted">–</span>}</td>
        <td className="is-num">
          {gf.quote !== null ? (
            <div className="d-quote">
              <span>{euros(gf.quote)}</span>
              <Variance value={gf.variance} />
            </div>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td className="is-num">{guests.length ? euros(value / guests.length) : "–"}</td>
        <td>
          {gf.fullyPaid ? (
            <OkPill small>Oui</OkPill>
          ) : gf.paid > 0 ? (
            <span className="d-small-muted">{euros(gf.paid)} payés</span>
          ) : gf.anyQuote ? (
            <span className="d-status" style={{ background: "var(--d-panel)", color: "var(--d-muted)", fontWeight: 500 }}>
              Non
            </span>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {gf.payers.length ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              {gf.payers.map((id) => (
                <PersonChip key={id} members={[memberById.get(id)].filter(Boolean)} />
              ))}
            </div>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          <span className="d-muted">–</span>
        </td>
        <td />
        <td />
      </tr>
    );
  };

  // Téléphone : ligne simple (icône, nom, prestataire | montant ou « Ajouter un devis »), comme la maquette
  const renderMobileRow = (it) => {
    const f = itemFinance(it, payments);
    const v = vendorById.get(it.vendor_id);
    const sub = v ? v.name : f.quote === null ? "Prestataire à choisir" : it.note || null;
    return (
      <div key={it.id} className="d-mrow">
        <Tile name={it.icon || guessIcon(it.label)} />
        <span className="d-mrow-text">
          <strong>{posteName(it)}</strong>
          {sub ? <small>{sub}</small> : null}
        </span>
        {f.quote !== null ? (
          <strong className="d-mrow-amount">{euros(f.quote)}</strong>
        ) : (
          <button
            type="button"
            className="d-link d-mrow-amount"
            onClick={() => {
              setQuoteFocus(true);
              setEditing(it);
            }}
          >
            Ajouter un devis
          </button>
        )}
      </div>
    );
  };

  const renderRow = (it, line, groupName) => {
    const f = itemFinance(it, payments);
    const v = vendorById.get(it.vendor_id);
    const docs = documents.filter((x) => x.budget_item_id === it.id);
    const devis = docs.find((x) => x.kind === "devis");
    const facture = docs.filter((x) => x.kind === "facture").pop();
    const perGuest = guests.length ? (f.quote ?? f.budgeted ?? 0) / guests.length : null;
    return (
      <tr key={it.id} className={line ? "d-line-row" : undefined}>
        <td>
          <div className={`d-budget-poste${line ? " is-line" : ""}`}>
            {line ? null : <Tile name={it.icon || guessIcon(it.label)} />}
            <span className="d-budget-poste-text">
              <button type="button" className={line ? "d-line-tag" : undefined} onClick={() => setEditing(it)} title="Modifier le poste">
                {line ? lineLabel(it, groupName) : posteName(it)}
              </button>
              {v ? <Link href={`/dashboard/budget/prestataires/${v.id}`}>{v.name}</Link> : it.note ? <small>{it.note}</small> : line ? <small>Prestataire à choisir</small> : null}
              {line ? null : (
                <button type="button" className="d-add-line-link" onClick={() => addLine(it.category || it.label)} title="Un autre prestataire dans ce poste : tentiste, foodtruck…">
                  Ajouter une ligne
                </button>
              )}
            </span>
          </div>
        </td>
        <td className="is-num">
          <InlineEdit
            value={f.budgeted !== null ? String(Math.round(f.budgeted)) : ""}
            display={f.budgeted !== null ? euros(f.budgeted) : null}
            label={`budget ${it.label}`}
            width={90}
            onSave={(val) => dash.update("budget_items", it.id, { budgeted: parseAmount(val) })}
          />
        </td>
        <td className="is-num">
          {f.quote !== null ? (
            <div className="d-quote">
              <span>{euros(f.quote)}</span>
              <Variance value={f.variance} />
            </div>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td className="is-num">{perGuest !== null ? euros(perGuest) : "–"}</td>
        <td>
          {f.fullyPaid ? (
            <OkPill small>Oui</OkPill>
          ) : f.paid > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
              <span className="d-pill" style={{ minHeight: 24, padding: "0 10px", fontSize: 12 }}>
                {f.paidList.length === 1 ? f.paidList[0].label : "Acomptes"}
              </span>
              <span className="d-small-muted">{euros(f.paid)} payés</span>
            </div>
          ) : f.quote !== null ? (
            <span className="d-status" style={{ background: "var(--d-panel)", color: "var(--d-muted)", fontWeight: 500 }}>
              Non
            </span>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {f.payers.length ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              {f.payers.map((id) => (
                <PersonChip key={id} members={[memberById.get(id)].filter(Boolean)} />
              ))}
            </div>
          ) : f.quote !== null ? (
            <span className="d-small-muted">À choisir</span>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {devis || facture ? (
            <div className="d-docs">
              {devis ? (
                <DocLink className="d-doc" doc={devis}>
                  <Icon name="file" size={13} sw={2} />
                  Devis
                </DocLink>
              ) : null}
              {facture ? (
                <DocLink className="d-doc" doc={facture}>
                  <Icon name="file" size={13} sw={2} />
                  Facture
                </DocLink>
              ) : null}
            </div>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td className="is-num">
          {lineAction(it, f)}
        </td>
        <td className="is-num">
          <span className="d-row-tools">
                          <button type="button" className="d-icon-btn is-flat" onClick={() => setEditing(it)} aria-label={`Modifier ${posteName(it)}`} title="Modifier le poste">
              <Icon name="pencil" size={15} sw={2} />
            </button>
            <button
              type="button"
              className="d-icon-btn is-flat is-danger"
              onClick={() => {
                const n = payments.filter((p) => p.budget_item_id === it.id).length;
                const nDocs = documents.filter((d) => d.budget_item_id === it.id).length;
                const lost = [n ? `${n} paiement${n > 1 ? "s" : ""}` : "", nDocs ? `${nDocs} document${nDocs > 1 ? "s" : ""}` : ""].filter(Boolean).join(" et ses ");
                if (window.confirm(`Supprimer ${it.category ? "la ligne" : "le poste"} « ${posteName(it)} »${lost ? ` et ses ${lost}` : ""} ?`)) dash.remove("budget_items", it.id);
              }}
              aria-label={`Supprimer ${posteName(it)}`}
              title="Supprimer le poste"
            >
              <Icon name="trash" size={15} sw={2} />
            </button>
          </span>
        </td>
      </tr>
    );
  };

  return (
    <>
      <BudgetHeader
        tab="depenses"
        actions={
          <span className="d-desk-only-flex" style={{ gap: 10 }}>
            <Btn kind="strong" icon="download" onClick={exportCsv}>
              Exporter
            </Btn>
            <Btn icon="plus" onClick={() => setAdding(true)}>
              Ajouter une dépense
            </Btn>
          </span>
        }
      />

      <div className="d-desk-only">
        <KpiBar items={kpis} plusHref="/dashboard/indicateurs/budget" />
      </div>
      <div className="d-mob-only">
        <div className="d-mstats">
          <div><strong>{euros(b.initial)}</strong><span>Budget initial</span></div>
          <div><strong>{euros(b.engaged)}</strong><span>Engagé</span></div>
          <div><strong>{euros(b.paid)}</strong><span>Déjà payé</span></div>
        </div>
      </div>

      <section className="d-card d-desk-only" style={{ padding: "24px 24px 26px" }}>
        <h2>Répartition</h2>
        <div className="d-split">
          <div className="d-col" style={{ gap: 14 }}>
            <div className="d-repart-head">
              <span>
                <strong>Qui a payé quoi</strong>
              </span>
              <button type="button" className="d-add-spend" onClick={() => setAdding(true)}>
                <span>
                  <Icon name="plus" size={14} sw={2.4} />
                </span>
                Ajouter une dépense
              </button>
            </div>
            <div className="d-repart">
              <Donut segments={paying.map((x) => ({ value: x.amount, color: pastel(x.member.color).mid }))} center={euros(b.paid)} sub="déjà payés" />
              <ul className="d-legend">
                {byPayer.map((x) => (
                  <li key={x.member.id}>
                    <span className="d-swatch" style={{ background: x.amount ? pastel(x.member.color).mid : "#efeee9" }} />
                    <span className="d-legend-text">
                      <span>{x.member.display_name}</span>
                    </span>
                    <span className="d-legend-amount">{euros(x.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="d-col" style={{ gap: 14 }}>
            <div className="d-repart-head">
              <span>
                <strong>Où va l'argent</strong>
              </span>
            </div>
            {signed.length ? (
              <div className="d-repart">
                <Donut segments={signed.map((it, i) => ({ value: Number(it.quote_amount), color: POSTE_COLORS[i % POSTE_COLORS.length] }))} center={euros(b.engaged)} sub="engagés" />
                <ul className="d-legend">
                  {signed.map((it, i) => (
                    <li key={it.id}>
                      <span className="d-swatch" style={{ background: POSTE_COLORS[i % POSTE_COLORS.length] }} />
                      <span className="d-legend-text">
                        <span>{posteName(it)}</span>
                      </span>
                      <span className="d-legend-amount">{euros(it.quote_amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="d-col">
        <Section title="Par poste" />

        <div className="d-cards d-mob-only">
          {groups.map((g) => (g.multi ? renderGroupCard(g) : renderMobileRow(g.items[0])))}
          <span className="d-desk-only">
            <div className="d-pcard-total">
              <span>
                Total <strong>{euros(b.sumBudgeted)}</strong>
              </span>
              <small>
                {euros(b.engaged)} engagés · {euros(b.paid)} payés
              </small>
            </div>
          </span>
        </div>

        <div className="d-mob-only">
          <button type="button" className="d-pill is-dashed" style={{ width: "100%", justifyContent: "center" }} onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} sw={2} />
            Ajouter une dépense
          </button>
        </div>

        <div className="d-table-wrap d-desk-only">
          <table className="d-table">
            <thead>
              <tr>
                <th>Poste</th>
                <th className="is-num">Budget</th>
                <th className="is-num">Devis signé</th>
                <th className="is-num">Par invité</th>
                <th>Payé ?</th>
                <th>Payé par</th>
                <th>Documents</th>
                <th aria-label="Statut" />
                <th aria-label="Modifier ou supprimer" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) =>
                g.multi ? (
                  <Fragment key={g.key}>
                    {renderGroupRow(g)}
                    {folded.has(g.key) ? null : g.items.map((it) => renderRow(it, true, g.name))}
                    {folded.has(g.key) ? null : (
                      <tr className="d-line-addrow">
                        <td colSpan={9}>
                          <button type="button" className="d-line-add" onClick={() => addLine(g.name)}>
                            <Icon name="plus" size={14} sw={2.4} />
                            Ajouter une ligne dans {g.name}
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ) : (
                  renderRow(g.items[0], false)
                ),
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="is-num">{euros(b.sumBudgeted)}</td>
                <td className="is-num">
                  <div className="d-quote">
                    <span>{euros(b.engaged)}</span>
                    {b.signed ? <Variance value={b.variance} big /> : null}
                  </div>
                </td>
                <td className="is-num" title="Moyenne des postes">
                  {avgPerGuest !== null ? euros(avgPerGuest) : "–"}
                  {avgPerGuest !== null ? <small className="d-muted" style={{ display: "block", fontSize: 11, fontWeight: 400 }}>en moyenne</small> : null}
                </td>
                <td colSpan={5}>{euros(b.paid)} payés</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="d-desk-only">
          <button type="button" className="d-pill is-dashed" onClick={() => setEditing("new")}>
            <Icon name="plus" size={14} sw={2} />
            Ajouter un poste
          </button>
        </div>
      </div>

      {adding ? <DepenseModal onClose={() => setAdding(false)} /> : null}
      {lining ? <LigneModal category={lining} onClose={() => setLining(null)} /> : null}
      {editing ? (
        <PosteModal
          item={editing === "new" ? null : editing}
          focusQuote={quoteFocus}
          onClose={() => {
            setEditing(null);
            setQuoteFocus(false);
          }}
        />
      ) : null}
    </>
  );
}
