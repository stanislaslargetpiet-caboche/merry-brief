"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { budgetTotals, groupFinance, groupItems, itemFinance, kpiItems, lineLabel, paidByPayer, posteName, removePosteMessage, unassignedPayments } from "@/lib/dash/model";
import { euros, shortDate, todayIso } from "@/lib/dash/format";
import { POSTE_COLORS, pastel } from "@/lib/dash/theme";
import { catForIcon } from "@/lib/dash/catalog";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Btn, Donut, KpiBar, OkPill, PersonChip, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import PosteModal from "@/components/dash/PosteModal";
import DepenseModal from "@/components/dash/DepenseModal";
import LigneModal from "@/components/dash/LigneModal";
import PaiementsModal from "@/components/dash/PaiementsModal";
import { DocLink } from "@/components/dash/Documents";

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
  const [editing, setEditing] = useState(null); // item | "new"
  const [adding, setAdding] = useState(null); // fenêtre « Ajouter une dépense » : true, ou l'id du poste déjà choisi
  const [paysOf, setPaysOf] = useState(null); // id du poste dont on ouvre les paiements
  const [lining, setLining] = useState(null); // nom du poste où l'on ajoute une ligne
  const [folded, setFolded] = useState(() => new Set()); // postes à plusieurs lignes repliés
  const [sort, setSort] = useState(null); // null (ordre des postes), "desc" ou "asc" : par montant
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

  // Tri par montant (devis signé, sinon budget) ; sans tri, l'ordre des postes
  const amountOf = (g) => g.items.reduce((acc, it) => {
    const f = itemFinance(it, payments);
    return acc + (f.quote ?? f.budgeted ?? 0);
  }, 0);
  const hasSpend = (g) => g.items.some((it) => {
    const f = itemFinance(it, payments);
    return f.quote !== null || f.paid > 0 || f.upcoming.length > 0;
  });
  const ordered = sort ? [...groups].sort((a, z) => (sort === "asc" ? amountOf(a) - amountOf(z) : amountOf(z) - amountOf(a))) : groups;
  // En tête, les postes où l'on a déjà engagé ou payé quelque chose ; les autres (budget seul, postes
  // créés à l'inscription ou ajoutés à la main) suivent, sans disparaître
  const sorted = ordered.filter(hasSpend);
  const planned = ordered.filter((g) => !hasSpend(g));
  const hasPayments = (it) => payments.some((p) => p.budget_item_id === it.id);
  // Le montant ou le statut d'une ligne ouvre ses paiements ; sans paiement, on en ajoute un pour ce poste
  const openPayments = (it) => (hasPayments(it) ? setPaysOf(it.id) : setAdding(it.id));
  const isLate = (f) => Boolean(f.next?.due_date && f.next.due_date < todayIso());

  const b = budgetTotals(data);
  const kpis = kpiItems(data, "budget");
  const memberById = new Map(members.map((m) => [m.id, m]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  // Postes à une seule ligne sans prestataire : ceux que « Tout matcher » propose de combler en premier
  const unmatched = groups.filter((g) => !g.multi && !g.items[0].vendor_id);

  // Répartition : qui a déjà payé quoi, et où va l'argent
  const byPayer = paidByPayer(data);
  const paying = byPayer.filter((x) => x.amount > 0);
  const unassigned = unassignedPayments(data).reduce((a, p) => a + Number(p.amount || 0), 0);
  // Où va l'argent : ce qui a été payé, par poste, avec le détail des lignes en dessous
  // pour les postes à plusieurs prestataires (traiteur, lieu…)
  const spending = groups
    .map((g) => ({ group: g, finance: groupFinance(g, payments) }))
    .filter(({ finance }) => finance.paid > 0)
    .map(({ group, finance }) => ({ group, finance, value: finance.paid }))
    .sort((a, z) => z.value - a.value);

  function exportCsv() {
    const head = ["Poste", "Ligne", "Prestataire", "Budget", "Devis signé", "Écart", "Par invité", "Payé", "Payé par", "Prochaine échéance"];
    const rows = groups.flatMap((g) => g.items.map((it) => [g, it])).map(([g, it]) => {
      const f = itemFinance(it, payments);
      return [
        g.multi ? g.name : it.category ? it.category : it.label,
        g.multi ? lineLabel(it) : it.category ? it.label : "",
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
      <button type="button" className="d-status is-done is-btn" onClick={() => openPayments(it)} title="Voir les paiements">
        <Icon name="check" size={12} sw={2.4} />
        Tout payé
      </button>
    ) : f.next ? (
      <button type="button" className={`d-status is-btn ${isLate(f) ? "is-red" : "is-todo"}`} onClick={() => openPayments(it)} title="Voir les paiements, marquer payé">
        {dueLabel(f.next, wedding.wedding_date)}
      </button>
    ) : f.quote !== null ? (
      <button type="button" className="d-status is-todo is-btn" onClick={() => openPayments(it)} title="Voir les paiements">
        Reste {euros(f.remaining)}
      </button>
    ) : (
      <button type="button" className="d-link" style={{ fontSize: 12 }} onClick={() => setAdding(it.id)}>
        Ajouter un paiement
      </button>
    );

  // Le montant d'une ligne : payé (sur le montant prévu), sinon le montant prévu, sinon le budget
  const amountCell = (f) =>
    f.paid > 0 ? (
      <span>{euros(f.paid)}</span>
    ) : f.hasPlan ? (
      <span className="d-muted">{euros(f.quote)}</span>
    ) : f.budgeted ? (
      <span className="d-amount-stack">
        <span className="d-muted">{euros(f.budgeted)}</span>
        <small>prévus</small>
      </span>
    ) : (
      <span className="d-muted">–</span>
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
          </span>
          <strong className="d-mrow-amount">{amountCell({ ...gf, remaining: null })}</strong>
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
                    {v ? <Link href={`/dashboard/budget/prestataires/${v.id}`}>{v.name}</Link> : <small>Prestataire à choisir</small>}
                  </span>
                  <span className="d-line-amount">
                    <strong>{amountCell(f)}</strong>
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
    return (
      <tr key={g.key} className="d-group-row">
        <td>
          <button type="button" className="d-gtoggle" aria-expanded={open} onClick={() => toggleGroup(g.key)}>
            <Tile name={g.items[0].icon || guessIcon(g.name)} />
            <span className="d-budget-poste-text">
              <strong>{g.name}</strong>
            </span>
            <span className={`d-gchev${open ? " is-open" : ""}`}>
              <Icon name="chev" size={16} sw={2.2} />
            </span>
          </button>
        </td>
        <td className="is-num">{amountCell({ ...gf, remaining: null })}</td>
        <td>
          {gf.fullyPaid ? (
            <OkPill small>Payé</OkPill>
          ) : gf.hasPlan ? (
            <span className={`d-status ${gf.lines.some(isLate) ? "is-red" : "is-todo"}`}>À payer</span>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {gf.fullyPaid || (gf.hasPlan && !gf.isAcompte) ? (
            <span className="d-status is-purple">100 %</span>
          ) : gf.hasPlan ? (
            <span className="d-status is-info">Acompte</span>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {gf.payers.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
              {gf.payers.map((id) => (
                <PersonChip key={id} members={[memberById.get(id)].filter(Boolean)} avatarOnly />
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
    const sub = v ? v.name : it.note || null;
    return (
      <div key={it.id} className="d-mrow">
        <Tile name={it.icon || guessIcon(it.label)} />
        <span className="d-mrow-text">
          <strong>{posteName(it)}</strong>
          {sub ? <small>{sub}</small> : null}
        </span>
        {f.paid > 0 || f.hasPlan || f.budgeted || hasPayments(it) ? (
          <button type="button" className="d-mrow-amount d-mrow-amount-btn" onClick={() => openPayments(it)} aria-label={`Paiements de ${posteName(it)}`}>
            {amountCell(f)}
          </button>
        ) : (
          <button type="button" className="d-link d-mrow-amount" onClick={() => setAdding(it.id)}>
            Ajouter un paiement
          </button>
        )}
      </div>
    );
  };

  const renderRow = (it, line) => {
    const f = itemFinance(it, payments);
    const v = vendorById.get(it.vendor_id);
    const docs = documents.filter((x) => x.budget_item_id === it.id);
    const devis = docs.find((x) => x.kind === "devis");
    const facture = docs.filter((x) => x.kind === "facture").pop();
    return (
      <tr key={it.id} className={line ? "d-line-row" : undefined}>
        <td>
          <div className={`d-budget-poste${line ? " is-line" : ""}`}>
            {line ? null : <Tile name={it.icon || guessIcon(it.label)} />}
            <span className="d-budget-poste-text">
              {line ? null : (
                <button type="button" onClick={() => setEditing(it)} title="Modifier le poste">
                  {posteName(it)}
                </button>
              )}
              {v ? (
                <Link href={`/dashboard/budget/prestataires/${v.id}`}>{v.name}</Link>
              ) : it.note ? (
                <small>{it.note}</small>
              ) : line ? (
                <small>Prestataire à choisir</small>
              ) : (
                <span className="d-vendor-cta">
                  <button type="button" className="d-vendor-add-link" onClick={() => setEditing(it)}>
                    Ajouter mon prestataire
                  </button>
                  <span className="d-vendor-cta-or">ou</span>
                  <Link href={`/dashboard/prestataires?cat=${catForIcon(it.icon || guessIcon(it.label))}`} className="d-match-link">
                    <Icon name="sparkle" size={11} sw={2.2} />
                    Voir les meilleurs matchs
                  </Link>
                </span>
              )}
              {line ? null : (
                <button type="button" className="d-add-line-link" onClick={() => addLine(it.category || it.label)} title="Un autre prestataire dans ce poste : tentiste, foodtruck…">
                  Ajouter une ligne
                </button>
              )}
            </span>
          </div>
        </td>
        <td className="is-num">{amountCell(f)}</td>
        <td>
          {f.fullyPaid ? (
            <button type="button" className="d-status is-done is-btn" onClick={() => openPayments(it)} title="Voir les paiements, changer le statut">
              <Icon name="check" size={12} sw={2.4} />
              Payé
            </button>
          ) : f.hasPlan ? (
            <button type="button" className={`d-status is-btn ${isLate(f) ? "is-red" : "is-todo"}`} onClick={() => openPayments(it)} title="Voir les paiements, changer le statut">
              À payer
            </button>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {f.fullyPaid || (f.hasPlan && !f.isAcompte) ? (
            <button type="button" className="d-status is-purple is-btn" onClick={() => openPayments(it)} title="Voir les paiements, changer le type">
              100 %
            </button>
          ) : f.hasPlan ? (
            <button type="button" className="d-status is-info is-btn" onClick={() => openPayments(it)} title="Voir les paiements, changer le type">
              Acompte
            </button>
          ) : (
            <span className="d-muted">–</span>
          )}
        </td>
        <td>
          {f.payers.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
              {f.payers.map((id) => (
                <PersonChip key={id} members={[memberById.get(id)].filter(Boolean)} avatarOnly />
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
                if (window.confirm(removePosteMessage(it, data))) dash.remove("budget_items", it.id);
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

  // Ordinateur : un poste du tableau (ligne seule, ou ligne de tête et ses lignes)
  const renderTableGroup = (g) =>
    g.multi ? (
      <Fragment key={g.key}>
        {renderGroupRow(g)}
        {folded.has(g.key) ? null : g.items.map((it) => renderRow(it, true))}
        {folded.has(g.key) ? null : (
          <tr className="d-line-addrow">
            <td colSpan={8}>
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
    );

  return (
    <>
      <BudgetHeader
        tab="depenses"
        actions={
          <span className="d-desk-only-flex" style={{ gap: 10 }}>
            {unmatched.length ? (
              <Btn kind="lime" icon="sparkle" href={`/dashboard/prestataires?cat=${catForIcon(unmatched[0].items[0].icon || guessIcon(unmatched[0].items[0].label))}`}>
                Tout matcher
              </Btn>
            ) : null}
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
          <div><strong>{euros(b.paid)}</strong><span>Payés</span></div>
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
              <Donut segments={[...paying.map((x) => ({ value: x.amount, color: pastel(x.member.color).mid })), ...(unassigned > 0 ? [{ value: unassigned, color: "#d9d7cf" }] : [])]} center={euros(b.paid)} sub="déjà payés" />
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
                {unassigned > 0 ? (
                  <li>
                    <span className="d-swatch" style={{ background: "#d9d7cf" }} />
                    <span className="d-legend-text">
                      <Link href="/dashboard/budget/repartition">Payeur à indiquer</Link>
                    </span>
                    <span className="d-legend-amount">{euros(unassigned)}</span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
          <div className="d-col" style={{ gap: 14 }}>
            <div className="d-repart-head">
              <span>
                <strong>Où va l'argent</strong>
              </span>
            </div>
            {spending.length ? (
              <div className="d-repart">
                <Donut segments={spending.map((s, i) => ({ value: s.value, color: POSTE_COLORS[i % POSTE_COLORS.length] }))} center={euros(spending.reduce((a, s) => a + s.value, 0))} sub="au total" />
                <ul className="d-legend">
                  {spending.map(({ group, finance, value }, i) => (
                    <li key={group.key} className={group.multi ? "is-group" : undefined}>
                      <span className="d-legend-row">
                        <span className="d-swatch" style={{ background: POSTE_COLORS[i % POSTE_COLORS.length] }} />
                        <span className="d-legend-text">
                          <span>{group.name}</span>
                        </span>
                        <span className="d-legend-amount">{euros(value)}</span>
                      </span>
                      {group.multi ? (
                        <ul className="d-legend-detail">
                          {finance.lines.map((f, j) => (
                            <li key={group.items[j].id}>
                              <span>{lineLabel(group.items[j])}</span>
                              <span>{euros(f.paid)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="d-col">
        <Section
          title="Par poste"
          right={
            <button type="button" className="d-sort-btn" onClick={() => setSort((x) => (x === "desc" ? "asc" : x === "asc" ? null : "desc"))} aria-label="Trier les postes par montant">
              <Icon name={sort === "asc" ? "arrowUp" : "arrowDown"} size={14} sw={2.2} />
              {sort === "desc" ? "Montant décroissant" : sort === "asc" ? "Montant croissant" : "Trier par montant"}
            </button>
          }
        />

        <div className="d-cards d-mob-only">
          {sorted.map((g) => (g.multi ? renderGroupCard(g) : renderMobileRow(g.items[0])))}
          {planned.map((g) => (g.multi ? renderGroupCard(g) : renderMobileRow(g.items[0])))}
          <button type="button" className="d-mrow d-mrow-add" onClick={() => setEditing("new")}>
            <Icon name="plus" size={14} sw={2.4} />
            Ajouter un poste
          </button>
          <div className="d-pcard-total">
            <span>
              Total payé <strong>{euros(b.paid)}</strong>
            </span>
          </div>
        </div>


        <div className="d-table-wrap d-desk-only">
          <table className="d-table">
            <thead>
              <tr>
                <th>Poste</th>
                <th className="is-num">Montant</th>
                <th>Statut</th>
                <th>Type</th>
                <th>Payé par</th>
                <th>Documents</th>
                <th>Échéance</th>
                <th aria-label="Modifier ou supprimer" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => renderTableGroup(g))}
              {planned.map((g) => renderTableGroup(g))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="is-num">{euros(b.paid)}</td>
                <td colSpan={6} />
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

      {/* Téléphone : le petit bouton noir « + » pour ajouter une dépense */}
      {!adding ? (
        <button type="button" className="d-fab" aria-label="Ajouter une dépense" onClick={() => setAdding(true)}>
          <Icon name="plus" size={22} sw={2.4} />
        </button>
      ) : null}
      {adding ? <DepenseModal key={String(adding)} itemId={typeof adding === "string" ? adding : undefined} onClose={() => setAdding(null)} /> : null}
      {paysOf && items.some((i) => i.id === paysOf) ? (
        <PaiementsModal
          item={items.find((i) => i.id === paysOf)}
          onClose={() => setPaysOf(null)}
          onAdd={() => {
            setAdding(paysOf);
            setPaysOf(null);
          }}
        />
      ) : null}
      {lining ? <LigneModal category={lining} onClose={() => setLining(null)} /> : null}
      {editing ? (
        <PosteModal
          item={editing === "new" ? null : items.find((i) => i.id === editing.id) || editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
