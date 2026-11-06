"use client";

// Messagerie (maquettes V5 ter, 6 nov. 2026) : les demandes de devis des couples, la conversation et la réponse au
// centre, les faits sur le côté. La réponse arrive dans le tableau de bord du couple (fiche du prestataire, dans
// Budget). Téléphone : la liste, puis la demande ouverte (?demande=…), puis la réponse en plein écran.

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { supabase } from "@/lib/supabase";
import { addDays, euros, isoDate, today } from "@/lib/dash/format";
import { budgetRange, dateLong, markThreadRead, messageAuthor, dateShortYear, firstName, guestsText, OPTION_UNIT, parseFrDate, quoteTotal, readSeenRequests, replyCost, requestDay, seasonOf, since, stageColor, STAGES, weddingWhen, writeSeenRequests } from "@/lib/pro/format";
import { CreditsCoins, ProIcon } from "@/components/pro/icons";
import { pastel } from "@/lib/dash/theme";
import { Face, Switch } from "@/components/pro/ui";

// Brouillons de réponse par demande : ils survivent au retour à la liste et au passage d'une demande à l'autre
const replyDrafts = new Map();
const proposals = new Set();

export default function DemandesPage() {
  return (
    <Suspense>
      <Demandes />
    </Suspense>
  );
}

function Demandes() {
  const pro = usePro();
  const router = useRouter();
  const params = useSearchParams();
  const d = pro.data;
  const [filter, setFilter] = useState("toutes");
  const [seen, setSeen] = useState(() => new Set());
  const clients = useMemo(() => new Map((d.clients || []).map((c) => [c.id, c])), [d.clients]);
  const all = d.requests || [];
  const list = all.filter((r) => (filter === "toutes" ? true : filter === "traiter" ? !r.answered : r.answered));
  const wanted = params.get("demande");
  const current = all.find((r) => r.client_id === wanted) || null;
  const shown = current || list[0] || null;

  useEffect(() => setSeen(readSeenRequests()), []);
  // Une demande ouverte est lue
  useEffect(() => {
    // Téléphone : la première demande de la liste n'est pas affichée tant qu'on ne l'ouvre pas
    const read = window.matchMedia("(max-width: 860px)").matches ? current : shown;
    if (!read) return;
    setSeen((s) => {
      if (s.has(read.client_id)) return s;
      const next = new Set(s).add(read.client_id);
      writeSeenRequests(next);
      return next;
    });
  }, [shown, current]);

  return (
    <div className={`p-demandes${current ? " is-open" : ""}`}>
      <div className="p-dem-top">
        <h1 className="p-h1 is-page p-dem-title">Messagerie.</h1>
        <div role="group" aria-label="Filtrer les demandes" className="p-pills is-scroll">
          {[
            ["toutes", "Toutes"],
            ["traiter", "À traiter"],
            ["repondues", "Répondues"],
          ].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} className={`p-pill is-filter${filter === k ? " is-on" : ""}`} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="p-dem-grid">
        <section aria-label="Liste des demandes" className="p-dem-list">
          {list.length ? (
            <ul aria-label="Demandes" className="p-dem-items">
              {list.map((r) => {
                const c = clients.get(r.client_id) || {};
                const unread = !r.answered && !seen.has(r.client_id);
                const on = shown?.client_id === r.client_id;
                return (
                  <li key={r.client_id}>
                    <Link href={`/pro/demandes?demande=${r.client_id}`} aria-current={on ? "true" : undefined} className={`p-dem-item${on ? " is-on" : ""}${unread ? " is-unread" : ""}`} scroll={false}>
                      <Face names={r.names} size={40} />
                      <span className="p-dem-text">
                        <span className="p-dem-line">
                          <span className="p-dem-name">{r.names}</span>
                          {unread ? <span aria-label="Non lue" className="p-dot" /> : null}
                        </span>
                        <span className="p-dem-meta">{[weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }, { short: true }), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                        <span className="p-dem-when">{r.answered ? "Répondue" : since(r.requested_at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-empty-line">{all.length ? "Aucune demande dans ce filtre." : "Aucune demande pour l’instant."}</p>
          )}
        </section>
        {shown ? <Detail key={shown.client_id} r={shown} c={clients.get(shown.client_id) || {}} onBack={() => router.push("/pro/demandes", { scroll: false })} /> : null}
      </div>
    </div>
  );
}

function Detail({ r, c, onBack }) {
  const pro = usePro();
  const d = pro.data;
  const byDay = new Map(d.dates.map((x) => [x.day, x]));
  const day = requestDay(r, c, d.dates);
  const dayIso = day?.iso || null;
  const flexible = !day;
  const booked = day?.entry || null;
  const bookedHere = !!day?.mine;
  const fallbacks = (r.dates || []).slice(1).map((t) => ({ t, iso: parseFrDate(t) }));
  const formulas = [...d.formulas].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const names = r.names.replace(" & ", " et ");
  const greeting = r.answered ? "" : `Bonjour ${names}, merci pour votre message. `;
  const [text, setText] = useState(() => replyDrafts.get(r.client_id) ?? greeting);
  const [drafting, setDrafting] = useState(false);
  const [proposed, setProposed] = useState(() => proposals.has(r.client_id));
  const [writing, setWriting] = useState(false);
  const [more, setMore] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const cost = c.source === "merry" && !c.answered_at ? replyCost(d.vendor?.primary_category) : 0;
  const [addQuote, setAddQuote] = useState(() => !r.answered && d.formulas.some((f) => f.price_low || f.price_high));
  const [mode, setMode] = useState(formulas.length ? "formules" : "pdf");
  const [formulaId, setFormulaId] = useState(formulas[0]?.id || null);
  const [optionIds, setOptionIds] = useState([]);
  const [file, setFile] = useState(null);
  const [manualLabel, setManualLabel] = useState("");
  const [manualDetail, setManualDetail] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  // Poser une option reste un choix : rien n'est bloqué dans l'agenda sans que le prestataire l'ait décidé
  const [hold, setHold] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  const fileRef = useRef(null);
  const formula = formulas.find((f) => f.id === formulaId) || null;
  const options = d.options.filter((o) => optionIds.includes(o.id));
  const season = dayIso ? seasonOf(dayIso, d.pro) : "high";
  const total = quoteTotal({ formula, options, guests: c.guests, season });
  const vibes = (r.vibes || []).filter((x) => x && !/sait pas/i.test(x));

  useEffect(() => {
    replyDrafts.set(r.client_id, text);
  }, [r.client_id, text]);

  useEffect(() => {
    if (r.answered) pro.loadThread(c.id).then(setThread);
    markThreadRead(r.client_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, r.answered]);

  // Une seule proposition par demande : elle remplace la formule d'accueil, jamais un texte déjà modifié
  useEffect(() => {
    if (r.answered || replyDrafts.has(`${r.client_id}:ia`)) return undefined;
    replyDrafts.set(`${r.client_id}:ia`, true);
    let gone = false;
    setDrafting(true);
    pro.draftReply(r.client_id, addQuote).then((draft) => {
      if (gone) return;
      setDrafting(false);
      if (!draft) return;
      setText((now) => {
        if (now !== greeting) return now;
        proposals.add(r.client_id);
        setProposed(true);
        return draft;
      });
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.client_id]);

  async function send() {
    if (!text.trim() && !(addQuote && mode === "pdf")) return;
    setBusy(true);
    let body = text.trim();
    if (addQuote && mode === "formules" && formula) {
      const lines = [`Devis : ${formula.name}${formula.unit === "par_invite" && c.guests ? ` pour ${c.guests} invités` : ""}, ${season === "low" ? "basse" : "haute"} saison`];
      for (const o of options) lines.push(`– ${o.name}${o.price !== null && o.price !== undefined ? ` : ${euros(o.price)} ${OPTION_UNIT[o.unit]}`.trimEnd() : ""}`);
      if (total !== null) lines.push(`Total : ${euros(total)}`);
      body = [body, lines.join("\n")].filter(Boolean).join("\n\n");
    }
    if (addQuote && mode === "manual" && (manualLabel.trim() || manualDetail.trim() || manualTotal)) {
      const lines = [`Devis${manualLabel.trim() ? ` : ${manualLabel.trim()}` : ""}`];
      for (const line of manualDetail.split("\n").map((l) => l.trim()).filter(Boolean)) lines.push(`– ${line}`);
      if (manualTotal) lines.push(`Total : ${euros(Number(manualTotal))}`);
      body = [body, lines.join("\n")].filter(Boolean).join("\n\n");
    }
    // Sans le fichier, le message annoncerait un devis absent : rien ne part, aucun crédit n'est dépensé
    let doc = null;
    if (addQuote && mode === "pdf" && file) {
      doc = await pro.addDocument(c.id, file);
      if (!doc) {
        setBusy(false);
        return;
      }
      let link = "";
      if (pro.mode === "live" && supabase) {
        const { data } = await supabase.storage.from("pro-fichiers").createSignedUrl(doc.storage_path, 60 * 60 * 24 * 30);
        link = data?.signedUrl ? `\n${data.signedUrl}` : "";
      }
      body = [body, `Devis joint : ${file.name}${link}`].filter(Boolean).join("\n\n");
    }
    const ok = await pro.sendMessage(c.id, body);
    if (ok) {
      if (hold && dayIso) await pro.setDay(dayIso, { status: "option", client_id: c.id, expires_on: isoDate(addDays(today(), 14)) });
      await pro.updateRow("pro_clients", "clients", c.id, { stage: c.stage === "nouvelle" ? "devis" : c.stage, next_action: "Relancer", next_action_on: isoDate(addDays(today(), 4)) });
      pro.setToast({ kind: "ok", text: `Réponse envoyée à ${r.names}.` });
      setText("");
      setProposed(false);
      setWriting(false);
      setFile(null);
      setAddQuote(false);
      setHold(false);
      setOptionIds([]);
      setManualLabel("");
      setManualDetail("");
      setManualTotal("");
      // Le fil est relu après l'envoi (démo comme réel) : l'ajouter aussi à la main l'affichait deux fois
      pro.loadThread(c.id).then(setThread);
    } else if (doc) {
      // Réponse refusée : le fichier repartira au prochain essai, sans doublon sur la fiche du client
      await pro.deleteRow("pro_documents", "documents", doc.id);
      if (pro.mode === "live" && supabase) await supabase.storage.from("pro-fichiers").remove([doc.storage_path]);
    }
    setBusy(false);
  }

  const budget = c.budget_label || budgetRange(r.budget);
  const ambiance = vibes.length ? vibes.map((v, i) => (i ? v.toLowerCase() : v)).join(" ") : null;
  const flexibleLabel = flexible && r.dates?.[0] ? r.dates[0].replace(/^Dates flexibles\s*:\s*/i, "Dates flexibles : ") : null;
  // Le rail des faits sur ordinateur ; les mêmes faits en pastilles sur téléphone (pastels demandés par Stan le 6 nov.)
  const chips = [
    r.region ? { icon: "pin", tone: "bleu", text: r.region } : null,
    guestsText(c.guests) ? { icon: "clients", tone: "sauge", text: guestsText(c.guests) } : null,
    budget ? { icon: "card", tone: "jaune", text: budget } : null,
    ambiance ? { icon: "sparkle", tone: "peche", text: ambiance } : null,
  ].filter(Boolean);
  const facts = [
    guestsText(c.guests) ? ["clients", "Invités", guestsText(c.guests).replace(/ invités?$/, "")] : null,
    r.region ? ["pin", "Lieu", r.region] : null,
    budget ? ["card", "Budget", budget] : null,
    ambiance ? ["sparkle", "Ambiance", ambiance] : null,
  ].filter(Boolean);
  const credits = d.pro?.credits ?? 0;
  const canHold = dayIso && (!booked || bookedHere);

  const dayBlock = (
    <div className="p-rep-day">
      <b>{dayIso ? dateShortYear(dayIso) : flexibleLabel || "Date à définir"}</b>
      {dayIso ? (
        <span className={`p-chip ${!booked ? "is-answered" : bookedHere ? "is-planned" : "is-late"}`}>
          {!booked ? "Libre dans votre agenda" : bookedHere ? `${booked.status === "reserve" ? "Réservé" : "En option"} pour ce couple` : booked.status === "reserve" ? "Déjà réservé" : "Option posée pour un autre couple"}
        </span>
      ) : null}
    </div>
  );
  const fallbackBlock = fallbacks.length ? (
    <div className="p-rep-fallbacks">
      <b>Dates de repli</b>
      {fallbacks.map(({ t, iso }) => {
        const x = iso ? byDay.get(iso) : null;
        return (
          <div key={t}>
            <span>{t}</span>
            <span className={`p-chip ${x ? (x.status === "reserve" ? "is-dark" : "is-late") : iso ? "is-answered" : "is-free"}`}>{x ? (x.status === "reserve" ? "Réservé" : "Option posée") : iso ? "Libre" : "À vérifier"}</span>
          </div>
        );
      })}
    </div>
  ) : null;
  const costLine = cost ? (
    <span className="p-rep-cost">
      <CreditsCoins size={16} />
      {credits >= cost ? `${cost} crédits · il vous en restera ${credits - cost}` : `${cost} crédits · il vous en manque ${cost - credits}`}
    </span>
  ) : (
    <span />
  );
  const quoteSummary = mode === "pdf" ? (file ? file.name : "PDF à choisir") : mode === "manual" ? manualLabel.trim() || "Devis sur mesure" : [formula?.name, optionIds.length ? `${optionIds.length} option${optionIds.length > 1 ? "s" : ""}` : null].filter(Boolean).join(", ");
  const quoteAmount = mode === "formules" && total !== null ? euros(total) : mode === "manual" && manualTotal ? euros(Number(manualTotal)) : null;

  return (
    <>
      <section aria-label={`Demande de ${r.names}`} className="p-dem-detail">
        <button type="button" className="p-back p-narrow-only" onClick={onBack}>
          <ProIcon name="prev" size={16} sw={2} />
          Demandes
        </button>
        <div className="p-dem-head">
          <Face names={r.names} size={36} />
          <div className="p-who is-3">
            <h2>{r.names}</h2>
            <span className="p-dem-received">Demande reçue {since(r.requested_at).toLowerCase().replace(/^(\d)/, "le $1")}</span>
          </div>
          <span className="p-chip p-dem-status" style={{ background: stageColor(c.stage).bg, color: stageColor(c.stage).ink }}>
            {STAGES.find((s) => s.key === (c.stage || "nouvelle"))?.label || "Nouvelle demande"}
          </span>
        </div>
        <div className="p-rep-scroll">
          <div className="p-narrow-only p-rep-facts-tel">
            {dayBlock}
            <div className="p-dem-chips">
              {chips.map((t) => (
                <span key={t.icon} style={{ background: pastel(t.tone).bg, color: pastel(t.tone).ink }}>
                  <ProIcon name={t.icon} size={15} stroke="currentColor" />
                  {t.text}
                </span>
              ))}
            </div>
          </div>
          {r.message ? (
            <div className="p-dem-block">
              <p className={`p-bubble${more ? " is-all" : ""}`}>{r.message}</p>
              {more ? null : (
                <button type="button" className="p-link is-small p-narrow-only p-start" onClick={() => setMore(true)}>
                  Lire tout
                </button>
              )}
            </div>
          ) : null}
          <div className="p-narrow-only">{fallbackBlock}</div>
          {thread.length ? (
            <ul className="p-thread">
              {thread.filter((m, i) => !(i === 0 && !m.from_vendor && m.body === r.message)).map((m) => {
                const a = m.from_vendor ? messageAuthor(m, d.members, d.user) : null;
                return (
                  <li key={m.id} className={m.from_vendor ? "is-me" : ""}>
                    <span className="p-thread-who">
                      {a ? (
                        <span aria-hidden="true" className="p-thread-face" style={{ background: a.color.mid, color: a.color.ink }}>
                          {a.initial}
                        </span>
                      ) : null}
                      {m.from_vendor ? (a ? (a.mine ? `${a.name} (vous)` : a.name) : "Vous") : firstName(r.names)} · {dateShortYear(new Date(m.sent_at)).replace(/ \d{4}$/, "")}
                    </span>
                    <p>{m.body}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="p-rep-bar p-narrow-only">
          {costLine}
          <button type="button" className="p-btn p-btn-primary is-big" onClick={() => setWriting(true)}>
            Répondre
          </button>
        </div>
        <section aria-label="Votre réponse" className={`p-rep-composer${writing ? " is-writing" : ""}`}>
          <div className="p-rep-composer-head p-narrow-only">
            <b>Votre réponse à {r.names}</b>
            <button type="button" className="d-icon-btn is-flat" aria-label="Fermer" onClick={() => setWriting(false)}>
              <ProIcon name="x" size={18} />
            </button>
          </div>
          <div className="p-rep-composer-body">
            <div className="p-rep-text">
              {proposed || drafting ? (
                <span className="p-rep-tag">
                  <ProIcon name="sparkle" size={14} stroke="currentColor" />
                  {drafting ? "Merry prépare une proposition…" : "Proposition de Merry, à relire"}
                </span>
              ) : null}
              <label htmlFor="rep" className="p-sr">
                Votre réponse
              </label>
              <textarea id="rep" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            {addQuote && !quoteOpen ? (
              <div className="p-rep-quote">
                <ProIcon name="file" size={18} />
                <span className="p-who">
                  <span className="p-who-name">Devis joint</span>
                  <span className="p-who-meta">{quoteSummary}</span>
                </span>
                {quoteAmount ? <b>{quoteAmount}</b> : null}
                <button type="button" className="p-link is-small" onClick={() => setQuoteOpen(true)}>
                  Modifier
                </button>
                <button type="button" className="d-icon-btn is-flat" aria-label="Retirer le devis" onClick={() => setAddQuote(false)}>
                  <ProIcon name="x" size={14} sw={2.2} />
                </button>
              </div>
            ) : !addQuote ? (
              <button
                type="button"
                className="p-dashed"
                onClick={() => {
                  setAddQuote(true);
                  setQuoteOpen(true);
                }}
              >
                <ProIcon name="file" size={18} />
                Joindre un devis
              </button>
            ) : (
              <div className="p-rep-quote-edit">
                <div role="group" aria-label="Type de devis" className="p-pills is-6">
                  {[
                    ["formules", "Mes formules", !formulas.length],
                    ["pdf", "PDF", false],
                    ["manual", "Sur mesure", false],
                  ].map(([k, l, off]) => (
                    <button key={k} type="button" disabled={off} aria-pressed={mode === k} className={`p-pill is-36${mode === k ? " is-on" : ""}`} onClick={() => setMode(k)}>
                      {l}
                    </button>
                  ))}
                </div>
                {mode === "pdf" ? (
                  <>
                    <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button type="button" className="p-dashed" onClick={() => fileRef.current?.click()}>
                      <ProIcon name="file" size={18} />
                      {file ? `Remplacer ${file.name}` : "Choisir le PDF du devis"}
                    </button>
                  </>
                ) : mode === "formules" ? (
                  <div className="p-quote">
                    <div className="p-pills is-6">
                      {formulas.map((f) => (
                        <button key={f.id} type="button" aria-pressed={formulaId === f.id} className={`p-pill is-36${formulaId === f.id ? " is-on" : ""}`} onClick={() => setFormulaId(f.id)}>
                          {f.name}
                        </button>
                      ))}
                    </div>
                    {d.options.length ? (
                      <div className="p-quote-options">
                        {d.options.map((o) => (
                          <label key={o.id}>
                            <span>
                              <input type="checkbox" checked={optionIds.includes(o.id)} onChange={() => setOptionIds((ids) => (ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id]))} />
                              {o.name}
                            </span>
                            <span className="p-muted">{o.price === null || o.price === undefined ? "Prix à définir" : `${euros(o.price)} ${OPTION_UNIT[o.unit]}`.trim()}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <div className="p-quote-total">
                      <span>Total, {season === "low" ? "basse" : "haute"} saison</span>
                      <span>{total === null ? "Prix à définir" : euros(total)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-quote">
                    <div className="p-field">
                      <span>Nom de la formule</span>
                      <input className="p-input" value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="Ex. Formule sur mesure" />
                    </div>
                    <div className="p-field">
                      <span>Détail, une ligne par élément</span>
                      <textarea rows={3} className="p-textarea" value={manualDetail} onChange={(e) => setManualDetail(e.target.value)} placeholder={"Ménage : 300 €\nOption DJ : 450 €"} />
                    </div>
                    <div className="p-field is-8">
                      <span>Total (€)</span>
                      <input className="p-input" inputMode="numeric" value={manualTotal} onChange={(e) => setManualTotal(e.target.value.replace(/[^\d]/g, ""))} />
                    </div>
                  </div>
                )}
                <div className="p-rep-quote-actions">
                  <button type="button" className="p-link is-small" onClick={() => setAddQuote(false)}>
                    Retirer le devis
                  </button>
                  <button type="button" className="p-link is-small" onClick={() => setQuoteOpen(false)}>
                    Réduire
                  </button>
                </div>
              </div>
            )}
            {canHold ? (
              <div className="p-hold">
                <span>
                  <span id="opt" className="p-hold-t">
                    Poser une option sur le {dateShortYear(dayIso).replace(/ \d{4}$/, "")}
                  </span>
                  <span className="p-hold-s">Bloquée 14 jours</span>
                </span>
                <Switch on={hold} onChange={setHold} labelledBy="opt" />
              </div>
            ) : null}
          </div>
          <div className="p-dem-send">
            {costLine}
            <button type="button" className="p-btn p-btn-primary is-big" onClick={send} disabled={busy || (!text.trim() && !(addQuote && mode === "pdf" && file))}>
              <ProIcon name="send" size={17} stroke="#ffffff" sw={2} />
              Envoyer la réponse
            </button>
          </div>
        </section>
      </section>
      <aside aria-label="La demande" className="p-rep-rail">
        {dayBlock}
        {facts.length ? (
          <div className="p-rep-rail-facts">
            {facts.map(([icon, label, value]) => (
              <div key={label}>
                <ProIcon name={icon} size={16} stroke="#6b6a63" />
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        ) : null}
        {fallbackBlock}
      </aside>
    </>
  );
}
