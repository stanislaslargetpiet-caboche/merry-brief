"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useData } from "@/lib/dash/store";
import { budgetTotals, chosenKpis, guestStats, kpiContext, paymentTitle, taskStats, upcomingTasks } from "@/lib/dash/model";
import { dayMonth, daysUntil, euros, longDate, shortDate } from "@/lib/dash/format";
import { DuoIcon, Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Bar, Btn, KpiBar, PersonChip, Section } from "@/components/dash/ui";
import { pastel } from "@/lib/dash/theme";
import TaskRow from "@/components/dash/TaskRow";
import WeddingModal from "@/components/dash/WeddingModal";

export default function Accueil() {
  const data = useData();
  const [editWedding, setEditWedding] = useState(false);
  const { wedding, members, items, payments } = data;

  const g = guestStats(data);
  const b = budgetTotals(data);
  // Bandeau « Importer mes documents » : affiché tant que des postes n'ont pas de devis, sauf s'il a été fermé
  const [bannerOff, setBannerOff] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("merry-import-banner") === "off") setBannerOff(true);
    } catch {
      /* ignore */
    }
  }, []);
  const quoteFiles = bannerOff || (items.length > 0 && b.signed >= items.length);
  const t = taskStats(data);
  const nFolders = (data.folders || []).length + (data.documents.some((d) => !d.folder_id) ? 1 : 0);
  const ctx = kpiContext(data);
  const kpis = chosenKpis(data, "accueil").map((k) => ({ id: k.id, label: k.label, pill: k.pill, ...k.get(ctx) }));

  const days = daysUntil(wedding.wedding_date);
  const title = [wedding.partner1, wedding.partner2].filter(Boolean).join(" & ");

  const week = data.tasks.filter((x) => !x.done && x.due_date && daysUntil(x.due_date) <= 7);
  const shown = week.length ? week.sort((a, z) => a.due_date.localeCompare(z.due_date)).slice(0, 5) : upcomingTasks(data, 3);

  const next = b.nextPayment;
  const nextItem = next ? items.find((i) => i.id === next.budget_item_id) : null;
  const nextPayer = next?.payer_id ? members.find((m) => m.id === next.payer_id) : null;

  // Bien démarrer
  const partner = members.find((m) => m.role === "couple" && m.id !== data.meId);
  const steps = [
    { label: "Remplir le brief", done: !!(data.brief || wedding.brief_id), href: data.brief || wedding.brief_id ? "/dashboard/brief" : "/" },
    partner ? { label: `Inviter ${partner.display_name}`, done: !!partner.user_id, href: "#organisateurs" } : { label: "Inviter votre moitié", done: false, href: "#organisateurs" },
    { label: "Importer les listes d'invités", done: g.total >= 10, href: "/dashboard/invites/importer" },
    { label: "Fixer le budget", done: wedding.budget_total !== null && wedding.budget_total !== undefined, act: () => setEditWedding(true) },
    { label: "Signer un premier devis", done: b.signed > 0, href: "/dashboard/budget" },
  ].sort((a, z) => Number(a.done) - Number(z.done));
  const doneSteps = steps.filter((s) => s.done).length;

  // Première connexion : rien n'est encore généré, tout part du rétroplanning
  const firstVisit = data.tasks.length === 0;

  const head = (
    <div className="d-home-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="d-title" style={{ fontSize: "clamp(26px, 6.4vw, 36px)" }}>
            {title}
          </h1>
          <div className="d-home-meta">
            <button type="button" className="d-pill" onClick={() => setEditWedding(true)}>
              <Icon name="calendar" size={14} />
              {wedding.wedding_date ? longDate(wedding.wedding_date) : "Choisir la date"}
            </button>
            <button type="button" className="d-pill" onClick={() => setEditWedding(true)}>
              <Icon name="pin" size={14} />
              {wedding.venue || wedding.region || "Ajouter le lieu"}
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
          {days !== null && days >= 0 ? (
            <div className="d-countdown">
              <strong>J-{days}</strong>
              <span>
                avant le <br />
                grand jour
              </span>
            </div>
          ) : null}
          <Link href="/dashboard/brief" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            Votre brief <Icon name="chev" size={16} sw={2} />
          </Link>
        </div>
    </div>
  );

  if (firstVisit) {
    const startSteps = [
      { label: "Créer votre espace", sub: "Votre brief est enregistré", done: true },
      { label: "Générer le rétroplanning", sub: "Quatre questions", href: "/dashboard/retroplanning/generer" },
      { label: "Importer votre liste d'invités", sub: "Excel, photo, PDF…", href: "/dashboard/invites/importer" },
      { label: "Inviter un organisateur", sub: "Votre moitié, vos parents, un témoin", href: "#organisateurs" },
    ];
    const startDone = startSteps.filter((s) => s.done).length;
    return (
      <>
        {head}
        <p className="d-lead" style={{ margin: 0 }}>
          Bienvenue sur Merry. Tout part du rétroplanning : quatre questions, et vous savez quoi faire et quand.
        </p>
        <div className="d-grid-side">
          <div className="d-col" style={{ gap: 26 }}>
            <section className="d-first-card">
              <span className="d-first-icon">
                <Icon name="calendar" size={30} sw={1.6} />
              </span>
              <div className="d-first-text">
                <h2>Votre rétroplanning</h2>
                <p>
                  Dites-nous ce qui est déjà fait : Merry prépare toutes les étapes{wedding.wedding_date ? ` jusqu'au ${longDate(wedding.wedding_date).replace(/^\S+\s/, "")}` : ""}, datées et réparties entre vous.
                </p>
                <span className="d-small d-muted">Environ 2 minutes</span>
              </div>
              <Btn icon="sparkle" href="/dashboard/retroplanning/generer">
                Générer un rétroplanning
              </Btn>
            </section>
            <div className="d-col">
              <Section title="Prochaines tâches" />
              <div className="d-empty">
                <p>Vos tâches apparaîtront ici dès que le rétroplanning sera prêt.</p>
                <Btn kind="ghost" small icon="sparkle" href="/dashboard/retroplanning/generer">
                  Générer un rétroplanning
                </Btn>
              </div>
            </div>
          </div>
          <div className="d-col">
            <section className="d-card">
              <h2>Bien démarrer</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bar value={(startDone / startSteps.length) * 100} />
                <span className="d-small d-muted">
                  {startDone}/{startSteps.length}
                </span>
              </div>
              <ul className="d-checklist">
                {startSteps.map((s) => (
                  <li key={s.label} className={s.done ? "is-done" : ""}>
                    {s.done ? (
                      <div className="d-check-row">
                        <span className="d-dot is-done">
                          <Icon name="check" size={13} sw={2.4} />
                        </span>
                        <span style={{ flex: 1 }}>
                          <span>{s.label}</span>
                          <small className="d-small d-muted" style={{ display: "block" }}>{s.sub}</small>
                        </span>
                      </div>
                    ) : (
                      <a href={s.href}>
                        <span className="d-dot" />
                        <span style={{ flex: 1 }}>
                          <span>{s.label}</span>
                          <small className="d-small d-muted" style={{ display: "block" }}>{s.sub}</small>
                        </span>
                        <Icon name="chev" size={16} sw={2} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        {editWedding ? <WeddingModal onClose={() => setEditWedding(false)} /> : null}
      </>
    );
  }

  return (
    <>
      {head}

      {!quoteFiles ? (
      <div className="d-import-banner">
        <span className="d-import-banner-icon">
          <Icon name="file" size={24} sw={1.8} />
        </span>
        <div className="d-import-banner-text">
          <strong>Des prestataires déjà réservés ?</strong>
          <span>Importez vos devis signés et vos factures réglées. Merry remplit le budget, les échéances et qui a payé quoi.</span>
        </div>
        <Btn icon="upload" href="/dashboard/budget/importer">
          Importer mes documents
        </Btn>
        <button
          type="button"
          className="d-icon-btn"
          aria-label="Masquer ce bandeau"
          onClick={() => {
            setBannerOff(true);
            try {
              window.localStorage.setItem("merry-import-banner", "off");
            } catch {
              /* ignore */
            }
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      ) : null}

      <KpiBar items={kpis} plusHref="/dashboard/indicateurs/accueil" />

      <div className="d-grid-side">
        <div className="d-col" style={{ gap: 28 }}>
          <div className="d-col">
            <Section title="Organiser" />
            <div className="d-g3">
              <Link href="/dashboard/invites" className="d-module">
                <span className="d-module-title">
                  <Tile name="users" size={40} bg="#ffffff" />
                  Invités
                </span>
                <span className="d-module-sub">{g.total ? `${g.attente} réponse${g.attente > 1 ? "s" : ""} en attente` : "Commencez la liste"}</span>
              </Link>
              <Link href="/dashboard/retroplanning" className="d-module">
                <span className="d-module-title">
                  <Tile name="calendar" size={40} bg="#ffffff" />
                  Rétroplanning
                </span>
                <span className="d-module-sub">
                  {t.overdue ? `${t.overdue} tâche${t.overdue > 1 ? "s" : ""} en retard` : t.week ? `${t.week} tâche${t.week > 1 ? "s" : ""} cette semaine` : "Rien d'urgent cette semaine"}
                </span>
              </Link>
              <Link href="/dashboard/budget" className="d-module">
                <span className="d-module-title">
                  <Tile name="wallet" size={40} bg="#ffffff" />
                  Budget
                </span>
                <span className="d-module-sub">{next?.due_date ? `Prochain paiement le ${shortDate(next.due_date)}` : b.paid ? `${euros(b.paid)} payés` : "Ajoutez vos premiers devis"}</span>
              </Link>
              <Link href="/dashboard/documents" className="d-module">
                <span className="d-module-title">
                  <Tile name="dossier" size={40} bg="#ffffff" />
                  Documents
                </span>
                <span className="d-module-sub">
                  {data.documents.length ? `${data.documents.length} document${data.documents.length > 1 ? "s" : ""} dans ${nFolders} dossier${nFolders > 1 ? "s" : ""}` : "Devis, mairie, cérémonie : tout au même endroit"}
                </span>
              </Link>
            </div>
          </div>

          <div className="d-col">
            <Section title={week.length ? "Cette semaine" : "Prochaines tâches"} right={<Link href="/dashboard/retroplanning" className="d-link">Tout le rétroplanning</Link>} />
            {shown.length ? (
              <div className="d-tasks">
                {shown.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="d-empty">
                <p>Rien d'urgent. Profitez-en !</p>
              </div>
            )}
          </div>

          <div className="d-col">
            <Section title="Bientôt" />
            <div className="d-g3 d-soon-grid">
              {[
                ["boutique", "Prestataires", "peche"],
                ["ecran", "Site de mariage", "bleu"],
                ["cadeau", "Liste & cagnotte", "lavande"],
              ].map(([icon, label, tone]) => (
                // Chaque brique à venir a son pastel clair
                <div key={label} className="d-module is-soon" style={{ background: pastel(tone).bg, color: pastel(tone).ink }}>
                  <Tile name={icon} size={36} bg="#ffffff" fill={pastel(tone).mid} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="d-col">
          <section className="d-card">
            <h2>Bien démarrer</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bar value={(doneSteps / steps.length) * 100} />
              <span className="d-small d-muted">
                {doneSteps}/{steps.length}
              </span>
            </div>
            <ul className="d-checklist">
              {steps.map((s) => (
                <li key={s.label} className={s.done ? "is-done" : ""}>
                  {s.act ? (
                    <button type="button" onClick={s.act}>
                      <span className={`d-dot${s.done ? " is-done" : ""}`}>{s.done ? <Icon name="check" size={13} sw={2.4} /> : null}</span>
                      <span style={{ flex: 1, textAlign: "left" }}>{s.label}</span>
                      <Icon name="chev" size={16} sw={2} />
                    </button>
                  ) : (
                    <a href={s.href}>
                      <span className={`d-dot${s.done ? " is-done" : ""}`}>{s.done ? <Icon name="check" size={13} sw={2.4} /> : null}</span>
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <Icon name="chev" size={16} sw={2} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {next && nextItem ? (
            <section className="d-card is-panel">
              <span className="d-small d-muted">Prochain paiement</span>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Tile name={nextItem.icon || guessIcon(nextItem.label)} size={40} bg="#ffffff" />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: 15 }}>{paymentTitle(nextItem, next)}</strong>
                  <span className="d-small d-muted">{next.due_date ? dayMonth(next.due_date) : "Sans date"}</span>
                </div>
                <span className="d-amount" style={{ fontSize: 19 }}>
                  {euros(next.amount)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                {nextPayer ? <PersonChip members={[nextPayer]} /> : <span className="d-small d-muted">Payeur à choisir</span>}
                <Link className="d-btn d-btn-primary d-btn-small" href={`/dashboard/budget/paiement/${nextItem.id}?echeance=${next.id}`}>
                  Marquer payé
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {editWedding ? <WeddingModal onClose={() => setEditWedding(false)} /> : null}
    </>
  );
}
