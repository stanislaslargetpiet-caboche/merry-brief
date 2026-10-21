"use client";

import Link from "next/link";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { budgetTotals, chosenKpis, itemFinance, kpiContext, paidByMember, paymentTitle } from "@/lib/dash/model";
import { euros, monthShort, parseAmount, shortDate, toDate } from "@/lib/dash/format";
import { POSTE_COLORS, pastel } from "@/lib/dash/theme";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Btn, Donut, InlineEdit, KpiBar, OkPill, PageHeader, PersonChip, Section } from "@/components/dash/ui";
import PosteModal from "@/components/dash/PosteModal";

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

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Budget() {
  const dash = useDash();
  const data = dash.data;
  const { items, members, vendors, documents, wedding, payments, guests } = data;
  const [editing, setEditing] = useState(null); // item | "new"
  const [quoteFocus, setQuoteFocus] = useState(false);

  const b = budgetTotals(data);
  const ctx = kpiContext(data);
  const kpis = chosenKpis(data, "budget").map((k) => ({ id: k.id, label: k.label, pill: k.pill, ...k.get(ctx) }));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Répartition
  const payers = members.filter((m) => Number(m.contribution || 0) > 0 || paidByMember(data, m.id) > 0);
  const payerList = payers.length ? payers : members;
  const contribTotal = b.contribTotal || b.initial;
  const signed = items.filter((i) => i.quote_amount !== null && i.quote_amount !== undefined).sort((a, z) => Number(z.quote_amount) - Number(a.quote_amount));

  const upcoming = b.upcoming.slice(0, 4);

  function exportCsv() {
    const head = ["Poste", "Prestataire", "Budget", "Devis signé", "Écart", "Par invité", "Payé", "Payé par", "Prochaine échéance"];
    const rows = items.map((it) => {
      const f = itemFinance(it, payments);
      return [
        it.label,
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

  return (
    <>
      <PageHeader
        title="Le budget."
        actions={
          <>
            <Btn kind="strong" icon="download" onClick={exportCsv}>
              Exporter
            </Btn>
            <Btn icon="plus" onClick={() => setEditing("new")}>
              Ajouter une dépense
            </Btn>
          </>
        }
      />

      <KpiBar items={kpis} plusHref="/dashboard/indicateurs/budget" />

      <section className="d-card" style={{ padding: "24px 24px 26px" }}>
        <h2>Répartition</h2>
        <div className="d-split">
          <div className="d-col" style={{ gap: 14 }}>
            <span className="d-small" style={{ fontWeight: 600, color: "#43423c", fontSize: 14 }}>
              Par payeur
            </span>
            <div className="d-repart">
              <Donut
                segments={payerList.map((m) => ({ value: Number(m.contribution || 0), color: pastel(m.color).mid }))}
                center={euros(contribTotal)}
                sub={b.contribTotal ? "budget" : "à répartir"}
              />
              <ul className="d-legend">
                {payerList.map((m) => (
                  <li key={m.id}>
                    <span className="d-swatch" style={{ background: pastel(m.color).mid }} />
                    <span className="d-legend-text">
                      <span>{m.display_name}</span>
                      <small>{euros(paidByMember(data, m.id))} déjà payés</small>
                    </span>
                    <span className="d-legend-amount">
                      <InlineEdit
                        value={m.contribution !== null && m.contribution !== undefined ? String(Math.round(m.contribution)) : ""}
                        display={m.contribution ? euros(m.contribution) : null}
                        placeholder="À définir"
                        label={`participation de ${m.display_name}`}
                        width={100}
                        onSave={(v) => dash.update("wedding_members", m.id, { contribution: parseAmount(v) })}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="d-col" style={{ gap: 14 }}>
            <span className="d-small" style={{ fontWeight: 600, color: "#43423c", fontSize: 14 }}>
              Par poste (devis signés)
            </span>
            {signed.length ? (
              <div className="d-repart">
                <Donut segments={signed.map((it, i) => ({ value: Number(it.quote_amount), color: POSTE_COLORS[i % POSTE_COLORS.length] }))} center={euros(b.engaged)} sub="engagés" />
                <ul className="d-legend">
                  {signed.map((it, i) => (
                    <li key={it.id}>
                      <span className="d-swatch" style={{ background: POSTE_COLORS[i % POSTE_COLORS.length] }} />
                      <span className="d-legend-text">
                        <span>{it.label}</span>
                        <small>{vendorById.get(it.vendor_id)?.name || " "}</small>
                      </span>
                      <span className="d-legend-amount">{euros(it.quote_amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Le camembert apparaît dès le premier devis signé.
              </p>
            )}
          </div>
        </div>
      </section>

      {upcoming.length ? (
        <div className="d-col">
          <Section title="Prochains paiements" />
          <div className="d-g4">
            {upcoming.map((p) => {
              const it = itemById.get(p.budget_item_id);
              const payer = p.payer_id ? memberById.get(p.payer_id) : null;
              const d = toDate(p.due_date);
              return (
                <div key={p.id} className="d-paycard">
                  <div className="d-paycard-top">
                    <span className="d-datepill">
                      {d ? d.getDate() : "?"} <small>{d ? monthShort(d) : "à planifier"}</small>
                    </span>
                    <span className="d-amount">{euros(p.amount)}</span>
                  </div>
                  <strong style={{ fontSize: 15, fontWeight: 500 }}>{paymentTitle(it, p)}</strong>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 36 }}>
                    {payer ? <PersonChip members={[payer]} /> : <span className="d-small d-muted">Payeur à choisir</span>}
                    {!payer || itemFinance(it, payments).paid === 0 ? (
                      <Link href={`/dashboard/budget/paiement/${it.id}?echeance=${p.id}`} className="d-btn d-btn-primary d-btn-small">
                        Marquer payé
                      </Link>
                    ) : (
                      <Link href={`/dashboard/budget/paiement/${it.id}?echeance=${p.id}`} className="d-link" style={{ fontSize: 12 }}>
                        Marquer payé
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="d-col">
        <Section title="Par poste" />
        <div className="d-table-wrap">
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
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const f = itemFinance(it, payments);
                const v = vendorById.get(it.vendor_id);
                const docs = documents.filter((x) => x.budget_item_id === it.id);
                const devis = docs.find((x) => x.kind === "devis");
                const facture = docs.filter((x) => x.kind === "facture").pop();
                const perGuest = guests.length ? (f.quote ?? f.budgeted ?? 0) / guests.length : null;
                return (
                  <tr key={it.id}>
                    <td>
                      <div className="d-budget-poste">
                        <Tile name={it.icon || guessIcon(it.label)} />
                        <span className="d-budget-poste-text">
                          <button type="button" onClick={() => setEditing(it)} title="Modifier le poste">
                            {it.label}
                          </button>
                          {v ? <Link href={`/dashboard/budget/prestataires/${v.id}`}>{v.name}</Link> : it.note ? <small>{it.note}</small> : null}
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
                            <a className="d-doc" href={devis.url} target="_blank" rel="noreferrer">
                              <Icon name="file" size={13} sw={2} />
                              Devis
                            </a>
                          ) : null}
                          {facture ? (
                            <a className="d-doc" href={facture.url} target="_blank" rel="noreferrer">
                              <Icon name="file" size={13} sw={2} />
                              Facture
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <span className="d-muted">–</span>
                      )}
                    </td>
                    <td className="is-num">
                      {f.fullyPaid ? (
                        <span className="d-status is-done">
                          <Icon name="check" size={12} sw={2.4} />
                          Tout payé
                        </span>
                      ) : f.quote !== null && f.paid === 0 ? (
                        <Link href={`/dashboard/budget/paiement/${it.id}${f.next ? `?echeance=${f.next.id}` : ""}`} className="d-btn d-btn-primary d-btn-small">
                          Noter un paiement
                        </Link>
                      ) : f.next ? (
                        <Link href={`/dashboard/budget/paiement/${it.id}?echeance=${f.next.id}`} className="d-status is-todo" style={{ textDecoration: "none" }}>
                          {dueLabel(f.next, wedding.wedding_date)}
                        </Link>
                      ) : f.quote !== null ? (
                        <Link href={`/dashboard/budget/paiement/${it.id}`} className="d-status is-todo" style={{ textDecoration: "none" }}>
                          Reste {euros(f.remaining)}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="d-link"
                          onClick={() => {
                            setQuoteFocus(true);
                            setEditing(it);
                          }}
                        >
                          Ajouter un devis
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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
                <td className="is-num">{b.perGuest !== null ? euros(b.perGuest) : "–"}</td>
                <td colSpan={4}>{euros(b.paid)} payés</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {b.initial && Math.round(b.sumBudgeted) !== Math.round(b.initial) ? (
          <p className="d-small d-muted" style={{ margin: 0 }}>
            Les postes totalisent {euros(b.sumBudgeted)} pour un budget initial de {euros(b.initial)}.
          </p>
        ) : null}
      </div>

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
