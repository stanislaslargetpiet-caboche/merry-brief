"use client";

// Dashboard de l'espace prestataire (maquettes « V1 ter », canvas Merry · Carte brief, 6 nov. 2026) : l'action
// d'abord. Le couple qui attend depuis le plus longtemps, puis ce qui est à suivre ; crédits, fiche et chiffres
// sur le côté. Tant qu'aucune demande n'est arrivée, le guide (V1 bis) prend la place.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePro } from "@/lib/pro/store";
import { dateShortYear, guestsText, isPastClient, budgetRange, completeness, PRO_SEEN_EVENT, replyCost, requestDay, since, unreadReplies, weddingWhen } from "@/lib/pro/format";
import { daysBetween, isoDate, today } from "@/lib/dash/format";
import { CreditsCoins, ProIcon } from "@/components/pro/icons";
import { Face } from "@/components/pro/ui";
import Guide from "@/components/pro/Guide";

const ask = (r) => `/pro/demandes?demande=${r.client_id}`;
const when = (r, c) => weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }, { short: true });

function DayChip({ day, short = false }) {
  if (!day) return null;
  if (day.free) return <span className="p-chip is-answered">{short ? "Date libre" : `${dateShortYear(day.iso).replace(/ \d{4}$/, "")} libre`}</span>;
  if (day.mine) return null;
  return <span className="p-chip is-late">{day.entry.status === "reserve" ? "Déjà réservé ce jour-là" : "Option posée ce jour-là"}</span>;
}

function Waiting({ todo, clients, dates, cost }) {
  const [first, ...rest] = todo;
  const c = clients.get(first.client_id) || {};
  const others = rest.slice(0, 2);
  return (
    <section aria-label="À traiter" className="p-home-hero">
      <h2>{todo.length > 1 ? `${todo.length} couples attendent votre réponse.` : "Un couple attend votre réponse."}</h2>
      <div className="p-home-first">
        <div className="p-home-first-who">
          <Face names={first.names} size={48} />
          <div>
            <strong>{first.names}</strong>
            <span>{[when(first, c), guestsText(c.guests), first.region, c.budget_label || budgetRange(first.budget)].filter(Boolean).join(" · ")}</span>
            <div className="p-home-chips">
              <DayChip day={requestDay(first, c, dates)} />
              <span className="p-chip is-free">
                <ProIcon name="horloge" size={14} />
                {since(first.requested_at)}
              </span>
            </div>
          </div>
        </div>
        <Link href={ask(first)} className="p-btn p-btn-primary is-big">
          Répondre · {cost} crédits
        </Link>
      </div>
      {others.length ? (
        <ul className="p-home-others">
          {others.map((r) => {
            const x = clients.get(r.client_id) || {};
            const day = requestDay(r, x, dates);
            return (
              <li key={r.client_id}>
                <Face names={r.names} size={40} />
                <span className="p-who">
                  <span className="p-who-name">{r.names}</span>
                  <span className="p-who-meta">{[when(r, x), guestsText(x.guests), since(r.requested_at)].filter(Boolean).join(" · ")}</span>
                </span>
                {day && !day.free ? <span className="p-desk-only"><DayChip day={day} /></span> : null}
                <Link href={ask(r)} className="p-btn p-btn-ghost is-40">
                  Voir
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      {rest.length > 2 ? (
        <Link href="/pro/demandes" className="p-link is-small">
          Voir les {rest.length - 2} autres
        </Link>
      ) : null}
    </section>
  );
}

// Ce qui demande un geste sans être une nouvelle demande : réponses reçues, options qui expirent, relances
function useFollowUps(d, clients) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener(PRO_SEEN_EVENT, again);
    return () => window.removeEventListener(PRO_SEEN_EVENT, again);
  }, []);
  return useMemo(() => {
    const now = isoDate(today());
    const byId = new Map((d.requests || []).map((r) => [r.client_id, r]));
    const name = (id) => clients.get(id)?.names || byId.get(id)?.names || "";
    const replies = unreadReplies(d).map((x) => ({ key: `m${x.client_id}`, icon: "bubble", title: `${name(x.client_id)} vous ont écrit`, meta: since(x.last_couple_at), href: `/pro/demandes?demande=${x.client_id}`, cta: "Lire" }));
    const options = (d.dates || [])
      .filter((x) => x.status === "option" && x.expires_on && x.expires_on >= now && daysBetween(today(), x.expires_on) <= 7)
      .map((x) => {
        const left = daysBetween(today(), x.expires_on);
        return { key: `o${x.id}`, icon: "calendar", title: `Option du ${dateShortYear(x.day)}`, meta: [name(x.client_id) || x.label, left ? `Expire dans ${left} jour${left > 1 ? "s" : ""}` : "Expire aujourd’hui"].filter(Boolean).join(" · "), href: "/pro/tarifs", cta: "Voir" };
      });
    const later = (d.clients || [])
      // Une demande sans réponse est déjà en tête de page : pas de doublon ici
      .filter((c) => c.next_action_on && c.next_action_on <= now && !["reserve", "perdu"].includes(c.stage) && !isPastClient(c) && (!byId.has(c.id) || byId.get(c.id).answered))
      .map((c) => ({ key: `r${c.id}`, icon: "file", title: `${c.next_action || "À relancer"} : ${c.names}`, meta: `Prévu le ${dateShortYear(c.next_action_on)}`, href: byId.has(c.id) ? `/pro/demandes?demande=${c.id}` : "/pro/clients", cta: "Voir" }));
    return [...replies, ...options, ...later].slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, clients, tick]);
}

export default function ProHome() {
  const pro = usePro();
  const d = pro.data;
  const clients = useMemo(() => new Map((d.clients || []).map((c) => [c.id, c])), [d.clients]);
  const requests = useMemo(() => d.requests || [], [d.requests]);
  const todo = useMemo(() => requests.filter((r) => !r.answered).sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at)), [requests]);
  const follow = useFollowUps(d, clients);
  const fill = completeness(d);
  const credits = d.pro?.credits ?? 0;
  const cost = replyCost(d.vendor?.primary_category);
  const replies = Math.floor(credits / cost);
  const booked = (d.clients || []).filter((c) => c.stage === "reserve" && !isPastClient(c)).length;
  const answered = requests.length - todo.length;

  return (
    <>
      <h1 className="p-h1 is-page">Dashboard.</h1>
      {requests.length ? null : <Guide />}
      <div className="p-home">
        <div className="p-home-main">
          {todo.length ? <Waiting todo={todo} clients={clients} dates={d.dates} cost={cost} /> : requests.length ? <p className="p-empty-line">Aucune demande à traiter.</p> : null}
          {follow.length ? (
            <section aria-label="À suivre" className="p-card p-home-follow">
              <h2 className="p-h2">À suivre.</h2>
              <ul>
                {follow.map((x) => (
                  <li key={x.key}>
                    <span aria-hidden="true" className="p-home-ico">
                      <ProIcon name={x.icon} size={18} />
                    </span>
                    <span className="p-who">
                      <span className="p-who-name">{x.title}</span>
                      <span className="p-who-meta">{x.meta}</span>
                    </span>
                    <Link href={x.href} className="p-btn p-btn-ghost is-40">
                      {x.cta}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <div className="p-home-side">
          <section aria-label="Crédits" className="p-card p-home-credits">
            <span>
              <b>
                <CreditsCoins size={20} />
                {credits}
              </b>
              <span className="p-who-meta">{replies ? `Soit ${replies} réponse${replies > 1 ? "s" : ""}` : "Moins d’une réponse"}</span>
            </span>
            <Link href="/pro/credits" className="p-link is-small">
              Historique
            </Link>
          </section>
          <section aria-label="Ma fiche" className="p-card p-home-fiche">
            <h2 className="p-h2">Ma fiche.</h2>
            {fill.missing.length ? (
              <div>
                {fill.missing.slice(0, 3).map((x) => (
                  <Link key={x.label} href={x.href}>
                    <span className="p-who">
                      <span className="p-who-name">{x.label}</span>
                      <span className="p-who-meta">{x.meta}</span>
                    </span>
                    <ProIcon name="next" size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="p-who-meta">Tout est rempli.</p>
            )}
          </section>
          <section aria-label="Chiffres" className="p-card p-home-stats">
            {[
              [d.stats?.views_7d ?? 0, "Vues, 7 jours"],
              [answered, "Répondues"],
              [booked, "Réservées"],
            ].map(([n, l]) => (
              <div key={l}>
                <b>{n}</b>
                <span className="p-who-meta">{l}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
