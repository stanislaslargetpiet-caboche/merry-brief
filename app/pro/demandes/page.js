"use client";

// Demandes (maquettes V5 et V5m) : les demandes de devis des couples, envoyées depuis leur page
// Prestataires. La réponse arrive dans le tableau de bord du couple (fiche du prestataire, dans Budget).
// Téléphone : la liste, puis la demande ouverte (?demande=…).

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { supabase } from "@/lib/supabase";
import { addDays, euros, isoDate, today } from "@/lib/dash/format";
import { budgetRange, dateLong, dateShortYear, firstName, guestsText, OPTION_UNIT, quoteTotal, seasonOf, since, weddingWhen } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Face, Switch } from "@/components/pro/ui";

const SEEN_KEY = "merry-pro-vues";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 19 juin 2027 » → « 2027-06-19 » (dates de repli écrites par le couple)
function parseFr(text) {
  const m = String(text || "")
    .toLowerCase()
    .match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/);
  const k = m ? MONTHS.indexOf(m[2]) : -1;
  return k >= 0 ? isoDate(new Date(Number(m[3]), k, Number(m[1]))) : null;
}

function readSeen() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

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

  useEffect(() => setSeen(readSeen()), []);
  // Une demande ouverte est lue
  useEffect(() => {
    if (!shown) return;
    setSeen((s) => {
      if (s.has(shown.client_id)) return s;
      const next = new Set(s).add(shown.client_id);
      try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [shown]);

  return (
    <div className={`p-demandes${current ? " is-open" : ""}`}>
      <div className="p-head-text is-8 p-dem-title">
        <h1 className="p-h1 is-page">Demandes.</h1>
        <p className="p-lead is-14">Les demandes des couples sont gratuites.</p>
      </div>
      <div className="p-dem-grid">
        <section aria-label="Liste des demandes" className="p-dem-list">
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
          {list.length ? (
            <ul aria-label="Demandes" className="p-dem-items">
              {list.map((r) => {
                const c = clients.get(r.client_id) || {};
                const unread = !r.answered && !seen.has(r.client_id);
                const on = shown?.client_id === r.client_id;
                return (
                  <li key={r.client_id}>
                    <Link href={`/pro/demandes?demande=${r.client_id}`} aria-current={on ? "true" : undefined} className={`p-dem-item${on ? " is-on" : ""}${unread ? " is-unread" : ""}`} scroll={false}>
                      {unread ? <span aria-label="Non lue" className="p-dot" /> : <span aria-hidden="true" className="p-dot is-empty" />}
                      <Face names={r.names} size={40} />
                      <span className="p-dem-text">
                        <span className="p-dem-line">
                          <span className="p-dem-name">{r.names}</span>
                          <span className="p-dem-when">{since(r.requested_at)}</span>
                        </span>
                        <span className="p-dem-meta">{[weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }, { short: true }), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                        <span className="p-dem-line">
                          <span className="p-dem-budget">{c.budget_label || budgetRange(r.budget) || "Budget non partagé"}</span>
                          {r.answered ? <span className="p-dem-done">Répondue</span> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-empty-line">{all.length ? "Aucune demande dans ce filtre." : "Aucune demande pour l’instant. Les couples vous écrivent depuis votre fiche Merry, et c’est gratuit pour vous."}</p>
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
  const dayIso = c.wedding_date || r.wedding_date || parseFr(r.dates?.[0]);
  const flexible = /flexible/i.test(r.dates?.[0] || "");
  const booked = dayIso ? byDay.get(dayIso) : null;
  const bookedHere = booked && booked.client_id === c.id;
  const fallbacks = (r.dates || []).slice(1).map((t) => ({ t, iso: parseFr(t) }));
  const formulas = [...d.formulas].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const names = r.names.replace(" & ", " et ");
  const [text, setText] = useState(() => (r.answered ? "" : `Bonjour ${names}, merci pour votre message. ${dayIso && !booked && !flexible ? `Le ${dateLong(dayIso).replace(/ \d{4}$/, "")} est libre. ` : ""}`));
  const [mode, setMode] = useState(formulas.length ? "formules" : "pdf");
  const [formulaId, setFormulaId] = useState(formulas[0]?.id || null);
  const [optionIds, setOptionIds] = useState([]);
  const [file, setFile] = useState(null);
  const [hold, setHold] = useState(!!dayIso && !booked && !flexible);
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  const fileRef = useRef(null);
  const formula = formulas.find((f) => f.id === formulaId) || null;
  const options = d.options.filter((o) => optionIds.includes(o.id));
  const season = dayIso ? seasonOf(dayIso, d.pro) : "high";
  const total = quoteTotal({ formula, options, guests: c.guests, season });
  const vibes = (r.vibes || []).filter((x) => x && !/sait pas/i.test(x));

  useEffect(() => {
    if (r.answered) pro.loadThread(c.id).then(setThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, r.answered]);

  async function send() {
    if (!text.trim() && mode !== "pdf") return;
    setBusy(true);
    let body = text.trim();
    if (mode === "formules" && formula) {
      const lines = [`Devis : ${formula.name}${formula.unit === "par_invite" && c.guests ? ` pour ${c.guests} invités` : ""}, ${season === "low" ? "basse" : "haute"} saison`];
      for (const o of options) lines.push(`– ${o.name}${o.price !== null && o.price !== undefined ? ` : ${euros(o.price)} ${OPTION_UNIT[o.unit]}`.trimEnd() : ""}`);
      if (total !== null) lines.push(`Total : ${euros(total)}`);
      body = [body, lines.join("\n")].filter(Boolean).join("\n\n");
    }
    if (mode === "pdf" && file) {
      const doc = await pro.addDocument(c.id, file);
      let link = "";
      if (doc && pro.mode === "live" && supabase) {
        const { data } = await supabase.storage.from("pro-fichiers").createSignedUrl(doc.storage_path, 60 * 60 * 24 * 30);
        link = data?.signedUrl ? `\n${data.signedUrl}` : "";
      }
      body = [body, `Devis joint : ${file.name}${link}`].filter(Boolean).join("\n\n");
    }
    const ok = await pro.sendMessage(c.id, body);
    if (ok) {
      if (hold && dayIso) await pro.setDay(dayIso, { status: "option", client_id: c.id, expires_on: isoDate(addDays(today(), 14)) });
      await pro.updateRow("pro_clients", "clients", c.id, { stage: c.stage === "nouvelle" ? "devis" : c.stage, next_action: "Relancer", next_action_on: isoDate(addDays(today(), 4)), answered_at: c.answered_at || new Date().toISOString() });
      pro.setToast({ kind: "ok", text: `Réponse envoyée à ${r.names}. Elle arrive dans leur tableau de bord Merry.` });
      setText("");
      setFile(null);
      if (pro.mode === "demo") setThread((t) => [...t, { id: String(Date.now()), from_vendor: true, body, sent_at: new Date().toISOString() }]);
      else pro.loadThread(c.id).then(setThread);
    }
    setBusy(false);
  }

  const chips = [r.region, flexible ? r.dates[0].replace(/^Dates flexibles\s*:\s*/i, "Dates flexibles : ") : dayIso ? dateLong(dayIso) : null, guestsText(c.guests), c.budget_label || budgetRange(r.budget), vibes.length ? vibes.map((v, i) => (i ? v.toLowerCase() : v)).join(" ") : null].filter(Boolean);

  return (
    <section aria-label={`Demande de ${r.names}`} className="p-dem-detail">
      <button type="button" className="p-back p-narrow-only" onClick={onBack}>
        <ProIcon name="prev" size={16} sw={2} />
        Demandes
      </button>
      <div className="p-dem-head">
        <Face names={r.names} size={48} />
        <div className="p-who is-3">
          <h2>{r.names}</h2>
          <span className="p-dem-received">Demande reçue {since(r.requested_at).toLowerCase().replace(/^(\d)/, "le $1")}</span>
        </div>
      </div>
      {dayIso && !flexible ? (
        <div>
          <span className={`p-free${booked && !bookedHere ? " is-taken" : ""}`}>
            <ProIcon name={booked && !bookedHere ? "calendar" : "check"} size={15} sw={2.2} />
            {!booked ? `Le ${dateLong(dayIso)} est libre dans votre agenda` : bookedHere ? `Le ${dateLong(dayIso)} est ${booked.status === "reserve" ? "réservé" : "en option"} pour ${r.names}` : `Le ${dateLong(dayIso)} est déjà ${booked.status === "reserve" ? "réservé" : "en option"} dans votre agenda`}
          </span>
        </div>
      ) : null}
      <div className="p-dem-chips">
        {chips.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {r.message ? (
        <div className="p-dem-block">
          <span className="p-dem-label">Leur message</span>
          <p className="p-bubble">{r.message}</p>
        </div>
      ) : null}
      {fallbacks.length ? (
        <div className="p-dem-block">
          <span className="p-dem-label">Dates de repli</span>
          {fallbacks.map(({ t, iso }) => {
            const x = iso ? byDay.get(iso) : null;
            return (
              <div key={t} className="p-fallback">
                <span>{t}</span>
                <span className={`p-chip ${x ? (x.status === "reserve" ? "is-dark" : "is-planned") : "is-free"}`}>{x ? (x.status === "reserve" ? "Réservé" : "Option posée") : iso ? "Libre" : "À vérifier"}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {thread.length ? (
        <div className="p-dem-block">
          <span className="p-dem-label">Vos échanges</span>
          <ul className="p-thread">
            {thread.slice(1).map((m) => (
              <li key={m.id} className={m.from_vendor ? "is-me" : ""}>
                <span className="p-thread-who">
                  {m.from_vendor ? "Vous" : firstName(r.names)} · {dateShortYear(String(m.sent_at).slice(0, 10)).replace(/ \d{4}$/, "")}
                </span>
                <p>{m.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="p-rule" />
      <div className="p-dem-block">
        <label htmlFor="rep" className="p-dem-reply-label">
          Votre réponse
        </label>
        <textarea id="rep" rows={4} className="p-textarea" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="p-dem-block is-10">
        <span className="p-dem-quote-label">Devis</span>
        <div className="p-radios">
          <label className={`p-radio${mode === "pdf" ? " is-on" : ""}`}>
            <input type="radio" name="devis" checked={mode === "pdf"} onChange={() => setMode("pdf")} />
            <span>
              <span className="p-radio-t">Joindre un devis</span>
              <span className="p-radio-s">{file ? file.name : "Un PDF depuis votre ordinateur"}</span>
            </span>
          </label>
          <label className={`p-radio${mode === "formules" ? " is-on" : ""}`}>
            <input type="radio" name="devis" checked={mode === "formules"} onChange={() => setMode("formules")} disabled={!formulas.length} />
            <span>
              <span className="p-radio-t">Créer un devis depuis mes formules</span>
              <span className="p-radio-s">{formulas.length ? "Merry calcule le total" : "Ajoutez d’abord vos formules dans Tarifs"}</span>
            </span>
          </label>
        </div>
        {mode === "pdf" ? (
          <>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button type="button" className="p-dashed" onClick={() => fileRef.current?.click()}>
              <ProIcon name="file" size={18} />
              {file ? `Remplacer ${file.name}` : "Choisir le PDF du devis"}
            </button>
          </>
        ) : (
          <div className="p-quote">
            <div className="p-field is-8">
              <span>Formule</span>
              <div className="p-pills is-6">
                {formulas.map((f) => (
                  <button key={f.id} type="button" aria-pressed={formulaId === f.id} className={`p-pill is-36${formulaId === f.id ? " is-on" : ""}`} onClick={() => setFormulaId(f.id)}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
            {d.options.length ? (
              <div className="p-quote-options">
                <span>Options</span>
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
              <span>Total calculé, {season === "low" ? "basse" : "haute"} saison</span>
              <span>{total === null ? "Prix à définir" : euros(total)}</span>
            </div>
          </div>
        )}
      </div>
      {dayIso && !flexible && (!booked || bookedHere) ? (
        <div className="p-hold">
          <span>
            <span id="opt" className="p-hold-t">
              Poser une option sur cette date
            </span>
            <span className="p-hold-s">
              {dateLong(dayIso)}, pour {r.names}
            </span>
          </span>
          <Switch on={hold} onChange={setHold} labelledBy="opt" />
        </div>
      ) : null}
      <div className="p-dem-send">
        <button type="button" className="p-btn p-btn-primary is-big" onClick={send} disabled={busy || (!text.trim() && !(mode === "pdf" && file))}>
          <ProIcon name="send" size={17} stroke="#ffffff" sw={2} />
          Envoyer
        </button>
      </div>
    </section>
  );
}
