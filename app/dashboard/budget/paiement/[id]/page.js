"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { itemFinance } from "@/lib/dash/model";
import { dayMonth, euros, parseAmount, shortDate, todayIso, uid } from "@/lib/dash/format";
import { pastel } from "@/lib/dash/theme";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Avatar, Bar, Btn, Field, PageHeader, Section } from "@/components/dash/ui";

const METHODS = [
  ["carte", "Carte bancaire", "card"],
  ["virement", "Virement", "bank"],
  ["cheque", "Chèque", "file"],
  ["especes", "Espèces", "wallet"],
];

export default function Paiement() {
  const { id } = useParams();
  const router = useRouter();
  const dash = useDash();
  const { items, vendors, members, payments, wedding } = dash.data;
  const item = items.find((i) => i.id === id);
  const [choice, setChoice] = useState(null); // id d'échéance | "reste" | "autre"
  const [other, setOther] = useState("");
  const [payers, setPayers] = useState([]);
  const [split, setSplit] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("virement");
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState({ label: "Solde", amount: "", due: "" });

  const f = item ? itemFinance(item, payments) : null;

  useEffect(() => {
    if (!item || choice) return;
    const wanted = new URLSearchParams(window.location.search).get("echeance");
    const first = f.upcoming.find((p) => p.id === wanted) || f.upcoming[0];
    setChoice(first ? first.id : f.remaining ? "reste" : "autre");
    if (first?.payer_id) setPayers([first.payer_id]);
    else if (dash.data.meId) setPayers([dash.data.meId]);
  }, [item, choice, f, dash.data.meId]);

  if (!item) {
    return (
      <>
        <PageHeader back={{ href: "/dashboard/budget", label: "Budget" }} title="Poste introuvable." />
      </>
    );
  }

  const vendor = vendors.find((v) => v.id === item.vendor_id);
  const echeance = f.upcoming.find((p) => p.id === choice);
  const amount = echeance ? Number(echeance.amount) : choice === "reste" ? f.remaining || 0 : parseAmount(other) || 0;
  const total = f.quote ?? f.budgeted ?? 0;
  const after = f.paid + amount;
  const mainPayer = members.find((m) => m.id === payers[0]);

  const togglePayer = (mid) => {
    if (!split) setPayers([mid]);
    else setPayers((x) => (x.includes(mid) ? x.filter((y) => y !== mid) : [...x, mid]));
  };

  async function save() {
    if (!amount || !payers.length) return;
    setBusy(true);
    const shares = payers.map((pid, i) => {
      const base = Math.floor((amount / payers.length) * 100) / 100;
      return { pid, amount: i === payers.length - 1 ? Math.round((amount - base * (payers.length - 1)) * 100) / 100 : base };
    });
    if (echeance) {
      await dash.update("payments", echeance.id, { paid_at: date, payer_id: shares[0].pid, amount: shares[0].amount, method });
      if (shares.length > 1) await dash.insert("payments", shares.slice(1).map((s) => ({ budget_item_id: item.id, label: echeance.label, amount: s.amount, due_date: echeance.due_date, paid_at: date, payer_id: s.pid, method })));
    } else {
      await dash.insert(
        "payments",
        shares.map((s) => ({ budget_item_id: item.id, label: choice === "reste" ? "Solde" : f.paid ? "Paiement" : "Acompte", amount: s.amount, due_date: date, paid_at: date, payer_id: s.pid, method })),
      );
    }
    const url = invoice.trim();
    if (url && /^https?:\/\//i.test(url)) await dash.insert("documents", { budget_item_id: item.id, vendor_id: vendor?.id || null, kind: "facture", name: echeance ? `Facture : ${echeance.label.toLowerCase()}` : "Facture", url });
    setBusy(false);
    dash.setToast({ kind: "ok", text: `Paiement de ${euros(amount)} noté.` });
    router.push("/dashboard/budget");
  }

  async function addPlan(e) {
    e.preventDefault();
    const a = parseAmount(plan.amount);
    if (!a) return;
    const newId = uid();
    await dash.insert("payments", { id: newId, budget_item_id: item.id, label: plan.label.trim() || "Échéance", amount: a, due_date: plan.due || null, paid_at: null, payer_id: payers[0] || null });
    setPlan({ label: "Solde", amount: "", due: "" });
  }

  const own = payments.filter((p) => p.budget_item_id === item.id).sort((a, z) => String(a.due_date || a.paid_at || "").localeCompare(String(z.due_date || z.paid_at || "")));

  return (
    <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader back={{ href: "/dashboard/budget", label: "Budget" }} title="Noter un paiement." />

      <section className="d-card" style={{ padding: 28, gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Tile name={item.icon || guessIcon(item.label)} size={52} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 18, fontWeight: 600 }}>{vendor?.name || item.label}</strong>
            <span className="d-small d-muted">
              {vendor?.category || item.label}
              {f.quote !== null ? ` · devis signé de ${euros(f.quote)}` : ""}
            </span>
          </div>
          <span className="d-pill" style={{ minHeight: 28, fontSize: 12, fontWeight: 600 }}>
            {f.fullyPaid ? "Tout payé" : f.paid ? `${euros(f.paid)} payés` : "Rien de payé"}
          </span>
        </div>

        <div className="d-col" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Quel paiement ?</strong>
          {f.upcoming.map((p) => (
            <button key={p.id} type="button" className={`d-choice${choice === p.id ? " is-on" : ""}`} onClick={() => setChoice(p.id)} aria-pressed={choice === p.id}>
              <span className="d-radio" />
              <span className="d-choice-text">
                <strong>{p.label}</strong>
                <span>{p.due_date ? (p.due_date === wedding.wedding_date ? "À régler le jour J" : `À régler avant le ${dayMonth(p.due_date)}`) : "Sans date"}</span>
              </span>
              <span className="d-amount">{euros(p.amount)}</span>
            </button>
          ))}
          {f.remaining && (!f.upcoming.length || Math.round(f.remaining) !== Math.round(f.upcoming.reduce((a, p) => a + Number(p.amount), 0)) || f.upcoming.length > 1) ? (
            <button type="button" className={`d-choice${choice === "reste" ? " is-on" : ""}`} onClick={() => setChoice("reste")} aria-pressed={choice === "reste"}>
              <span className="d-radio" />
              <span className="d-choice-text">
                <strong>{f.paid ? "Tout le reste" : "Totalité"}</strong>
                <span>En une seule fois</span>
              </span>
              <span className="d-amount">{euros(f.remaining)}</span>
            </button>
          ) : null}
          <button type="button" className={`d-choice${choice === "autre" ? " is-on" : ""}`} onClick={() => setChoice("autre")} aria-pressed={choice === "autre"}>
            <span className="d-radio" />
            <span className="d-choice-text">
              <strong>Autre montant</strong>
              <span>Vous choisissez</span>
            </span>
            {choice === "autre" ? (
              <input className="d-input" style={{ width: 130, minHeight: 36 }} inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Montant €" autoFocus />
            ) : null}
          </button>
        </div>

        <div className="d-col" style={{ gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Qui paie ?</strong>
          <div className="d-filters">
            {members.map((m) => {
              const p = pastel(m.color);
              const on = payers.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  className="d-person"
                  style={{ background: p.bg, color: p.ink, border: 0, minHeight: 36, padding: "4px 14px 4px 5px", fontSize: 14, cursor: "pointer", boxShadow: on ? `0 0 0 2px #fff, 0 0 0 3.5px var(--d-ink)` : undefined }}
                  onClick={() => togglePayer(m.id)}
                  aria-pressed={on}
                >
                  <Avatar member={m} size={24} />
                  {m.display_name}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={`d-pill is-dashed${split ? " is-on" : ""}`}
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              setSplit((x) => !x);
              if (split) setPayers((x) => x.slice(0, 1));
            }}
          >
            {split ? "Un seul payeur" : "Partager le paiement"}
          </button>
          {split && payers.length > 1 ? <span className="d-small d-muted">{payers.length} parts de {euros(amount / payers.length)}</span> : null}
        </div>

        <div className="d-form-grid">
          <Field label="Payé le">
            <input className="d-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Comment ?">
            <select className="d-select" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lien de la facture (facultatif)" full>
            <input className="d-input" type="url" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="https://" />
          </Field>
        </div>

        {total ? (
          <div className="d-card is-panel" style={{ gap: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
              <span className="d-muted">Après ce paiement</span>
              <span>
                <strong>{euros(after)}</strong> <span className="d-muted">payés sur {euros(total)}</span>
              </span>
            </div>
            <Bar value={(after / total) * 100} color={mainPayer ? pastel(mainPayer.color).mid : "#1c1c1a"} />
          </div>
        ) : null}

        <Btn onClick={save} disabled={busy || !amount || !payers.length} className="d-btn-block" icon="check">
          Noter le paiement de {euros(amount)}
        </Btn>
        <p className="d-small d-muted" style={{ margin: 0, textAlign: "center" }}>
          Vous réglez le prestataire comme d'habitude, Merry garde la trace. Le paiement directement depuis Merry arrive bientôt.
        </p>
      </section>

      <Section title="Échéancier" />
      <section className="d-card" style={{ gap: 4 }}>
        {own.length ? (
          own.map((p) => {
            const payer = members.find((m) => m.id === p.payer_id);
            return (
              <div key={p.id} className="d-contact-row" style={{ alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{p.label}</strong>
                  <small>
                    {p.paid_at ? `Payé le ${shortDate(p.paid_at)}` : p.due_date ? `Prévu le ${shortDate(p.due_date)}` : "Sans date"}
                    {payer ? ` · ${payer.display_name}` : ""}
                  </small>
                </div>
                <span className="d-amount" style={{ fontSize: 14 }}>
                  {euros(p.amount)}
                </span>
                {p.paid_at ? (
                  <span className="d-okpill is-small">
                    <Icon name="check" size={12} sw={2.4} />
                    Payé
                  </span>
                ) : null}
                <button
                  type="button"
                  className="d-icon-btn"
                  aria-label={`Supprimer ${p.label}`}
                  onClick={() => {
                    if (window.confirm(`Supprimer « ${p.label} » de ${euros(p.amount)} ?`)) dash.remove("payments", p.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })
        ) : (
          <p className="d-small d-muted" style={{ margin: 0 }}>
            Aucun paiement pour l'instant.
          </p>
        )}
        <form className="d-org-form d-plan-form" style={{ marginTop: 12 }} onSubmit={addPlan}>
          <Field label="Prévoir une échéance">
            <input className="d-input" value={plan.label} onChange={(e) => setPlan((x) => ({ ...x, label: e.target.value }))} placeholder="Solde" />
          </Field>
          <Field label="Montant">
            <input className="d-input" inputMode="decimal" value={plan.amount} onChange={(e) => setPlan((x) => ({ ...x, amount: e.target.value }))} placeholder="€" />
          </Field>
          <Field label="Pour le">
            <input className="d-input" type="date" value={plan.due} onChange={(e) => setPlan((x) => ({ ...x, due: e.target.value }))} />
          </Field>
          <Btn type="submit" kind="ghost" icon="plus">
            Ajouter
          </Btn>
        </form>
      </section>
    </div>
  );
}
