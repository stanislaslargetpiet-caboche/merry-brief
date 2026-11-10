"use client";

// Le formulaire invités, le même sur la page publique (/f/[slug]) et dans la rubrique « Ta réponse »
// du site de mariage (GuestFormInline). Les questions suivent l'ordre choisi par le couple
// (lib/dash/form.js, formQuestions) ; la réponse part par /api/formulaire/repondre (merry_form_submit,
// puis mail de confirmation à l'invité) et reste dans le navigateur (RESPONSE_KEY) pour que le site la
// rappelle à l'invité.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dayMonth } from "@/lib/dash/format";
import { DIETS, fieldLabel, fieldMode, formQuestions, isClosed, withPresets } from "@/lib/dash/form";
import { RESPONSE_KEY } from "@/lib/site/model";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readDemoForm(slug) {
  try {
    const raw = window.localStorage.getItem("merry-demo-v1");
    const data = raw ? JSON.parse(raw)?.data : null;
    if (!data?.form || data.form.slug !== slug) return null;
    return {
      partner1: data.wedding.partner1,
      partner2: data.wedding.partner2,
      wedding_date: data.wedding.wedding_date,
      venue: data.wedding.venue,
      ...data.form,
      events: data.events.filter((e) => data.form.event_ids.includes(e.id)).map((e) => ({ id: e.id, name: e.name })),
      demo: true,
    };
  } catch {
    return null;
  }
}

// Lit le formulaire : par Supabase, sinon celui de la démo gardé dans le navigateur
export function useGuestForm(slug, { preview = false } = {}) {
  const [state, setState] = useState({ status: "loading", form: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      let form = null;
      if (!preview && supabase) {
        const { data, error } = await supabase.rpc("merry_form_public", { form_slug: String(slug) });
        if (error) console.error("[merry] formulaire", error);
        form = data || null;
      }
      if (!form) form = readDemoForm(String(slug));
      if (alive) setState(form ? { status: "ready", form: withPresets(form) } : { status: "missing", form: null });
    })();
    return () => {
      alive = false;
    };
  }, [slug, preview]);
  return state;
}

// La réponse passe par la route Merry, qui l'enregistre puis envoie à l'invité un mail de confirmation.
// Route indisponible (serveur sans Supabase : 501) : envoi direct à Supabase, sans mail.
async function sendAnswer(slug, payload) {
  try {
    const res = await fetch("/api/formulaire/repondre", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, payload }) });
    if (res.status !== 501 && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      return { error: res.ok ? null : { message: String(body.error || res.status) } };
    }
  } catch (e) {
    return { error: { message: e?.message || "réseau" } };
  }
  return supabase.rpc("merry_form_submit", { form_slug: slug, payload });
}

function Pills({ options, value, onChange, label, missing }) {
  return (
    <div className={`gf-pills${missing ? " is-missing" : ""}`} role="group" aria-label={label}>
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const text = typeof o === "string" ? o : o.label;
        return (
          <button key={id} type="button" className={`gf-pill${value === id ? " is-on" : ""}`} aria-pressed={value === id} onClick={() => onChange(value === id ? null : id)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

const YESNO = [
  { id: "oui", label: "Oui" },
  { id: "non", label: "Non" },
];

const EMPTY_PERSON = { first_name: "", last_name: "", email: "", phone: "", address: "", diet: null, allergies: "" };

export default function GuestForm({ form, slug, onAnswered }) {
  const [me, setMe] = useState(EMPTY_PERSON);
  const [plus, setPlus] = useState(null); // "oui" | "non" | null
  const [other, setOther] = useState({ ...EMPTY_PERSON, same_address: true });
  const [answers, setAnswers] = useState({});
  const [kids, setKids] = useState({ count: "", ages: "" });
  const [lodging, setLodging] = useState(null);
  const [custom, setCustom] = useState({});
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const root = useRef(null);

  const mode = (key) => fieldMode(form, key);
  const label = (key) => fieldLabel(form, key);
  const star = (key) => (mode(key) === "req" ? " *" : "");
  const globalPresence = form.presence_mode === "global";
  const events = form.events || [];
  const withPlus = mode("plusun") !== "off" && plus === "oui";
  const closed = isClosed(form);

  function check() {
    const miss = [];
    const need = (key, ok, text) => {
      if (!ok) miss.push({ key, text });
    };
    need("first_name", me.first_name.trim(), "Prénom");
    need("last_name", me.last_name.trim(), "Nom");
    need("email", EMAIL_RE.test(me.email.trim()), "Mail");
    if (mode("tel") === "req") need("phone", me.phone.trim(), label("tel"));
    if (mode("adresse") === "req") need("address", me.address.trim(), label("adresse"));
    if (mode("presence") === "req") {
      if (globalPresence) need("ev:all", answers.all, "Seras-tu des nôtres ?");
      else for (const e of events) need(`ev:${e.id}`, answers[e.id], e.name);
    }
    if (mode("plusun") === "req") need("plus", plus, label("plusun"));
    if (withPlus) {
      need("p_first_name", other.first_name.trim(), "Prénom de l'accompagnant");
      need("p_last_name", other.last_name.trim(), "Nom de l'accompagnant");
      // Le mail de l'accompagnant est facultatif ; s'il est donné, il doit être une adresse
      need("p_email", !other.email.trim() || EMAIL_RE.test(other.email.trim()), "Mail de l'accompagnant (adresse incomplète)");
      if (mode("tel") === "req") need("p_phone", other.phone.trim(), "Téléphone de l'accompagnant");
      if (mode("adresse") === "req" && !other.same_address) need("p_address", other.address.trim(), "Adresse de l'accompagnant");
    }
    if (mode("regime") === "req") {
      need("diet", me.diet, label("regime"));
      if (withPlus) need("p_diet", other.diet, `${label("regime")} de l'accompagnant`);
    }
    if (mode("enfants") === "req") need("kids", kids.count !== "", label("enfants"));
    if (mode("hebergement") === "req") need("lodging", lodging, label("hebergement"));
    if (mode("mot") === "req") need("note", note.trim(), label("mot"));
    for (const c of form.custom) if (c.req) need(`c:${c.id}`, String(custom[c.id] || "").trim(), c.label);
    return miss;
  }

  // Champs encore manquants, recalculés à chaque frappe après un premier envoi
  const live = missing.length ? new Set(check().map((m) => m.key)) : null;
  const isMissing = (k) => !!live?.has(k);

  // Après un envoi incomplet, la page va au premier champ à corriger (pas au résumé en bas)
  useEffect(() => {
    if (!attempt) return;
    const first = root.current?.querySelector(".is-missing");
    if (!first) return;
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = first.matches("input, textarea") ? first : first.querySelector("input, textarea, button");
    input?.focus({ preventScroll: true });
  }, [attempt]);

  async function submit() {
    const miss = check();
    setMissing(miss.map((m) => m.key));
    if (miss.length) {
      setAttempt((n) => n + 1);
      return;
    }
    const n = Number(kids.count);
    const payload = {
      first_name: me.first_name,
      last_name: me.last_name,
      email: me.email,
      phone: me.phone,
      address: me.address,
      diet: me.diet,
      allergies: me.allergies,
      answers: globalPresence ? Object.fromEntries(events.map((e) => [e.id, answers.all]).filter(([, v]) => v)) : answers,
      plus_one: withPlus
        ? { first_name: other.first_name, last_name: other.last_name, email: other.email, phone: other.phone, address: other.address, same_address: other.same_address, diet: other.diet, allergies: other.allergies }
        : null,
      enfants: kids.count === "" ? null : n === 0 ? "Aucun" : `${n} enfant${n > 1 ? "s" : ""}${kids.ages.trim() ? ` (${kids.ages.trim()})` : ""}`,
      hebergement: lodging === "oui" ? "Oui" : lodging === "non" ? "Non" : null,
      mot: note,
      custom: Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, v === "oui" ? "Oui" : v === "non" ? "Non" : v])),
    };
    // Gardée sur ce navigateur : le site de mariage la rappelle à l'invité (« Tu seras des nôtres »)
    const remember = () => {
      try {
        const names = [`${me.first_name} ${me.last_name}`.trim(), withPlus ? `${other.first_name} ${other.last_name}`.trim() : ""].filter(Boolean);
        const yes = events.filter((e) => payload.answers[e.id] === "oui").map((e) => e.name);
        const answered = Object.values(payload.answers).filter(Boolean);
        window.localStorage.setItem(
          RESPONSE_KEY(String(slug)),
          JSON.stringify({ names: names.length > 1 ? `${names[0]} et ${names[1]}` : names[0], moments: yes.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)), present: answered.length ? yes.length > 0 : null, at: new Date().toISOString() }),
        );
      } catch {
        // stockage indisponible : le site invitera simplement à répondre
      }
    };
    setSending(true);
    if (form.demo || !supabase) {
      console.info("[merry] démo : réponse simulée", payload);
      remember();
      setDone({ ok: true });
      setSending(false);
      onAnswered?.();
      return;
    }
    const { error } = await sendAnswer(String(slug), payload);
    setSending(false);
    if (error) {
      console.error("[merry] envoi du formulaire", error);
      setMissing([]);
      const msg = error.message || "";
      setDone({ error: /Liste complète/.test(msg) ? "full" : /Date limite/.test(msg) ? "closed" : /Trop de réponses/.test(msg) ? "busy" : "failed" });
      return;
    }
    remember();
    setDone({ ok: true });
    onAnswered?.();
  }

  const person = (p, set, prefix) => (
    <div className="gf-g2">
      <label className="gf-field">
        Prénom *
        <input className={`gf-input${isMissing(`${prefix}first_name`) ? " is-missing" : ""}`} autoComplete={prefix ? "off" : "given-name"} value={p.first_name} maxLength={80} onChange={(e) => set({ ...p, first_name: e.target.value })} />
      </label>
      <label className="gf-field">
        Nom *
        <input className={`gf-input${isMissing(`${prefix}last_name`) ? " is-missing" : ""}`} autoComplete={prefix ? "off" : "family-name"} value={p.last_name} maxLength={80} onChange={(e) => set({ ...p, last_name: e.target.value })} />
      </label>
      <label className="gf-field">
        Mail{prefix ? "" : " *"}
        <input className={`gf-input${isMissing(`${prefix}email`) ? " is-missing" : ""}`} type="email" autoComplete={prefix ? "off" : "email"} value={p.email} maxLength={200} onChange={(e) => set({ ...p, email: e.target.value })} />
      </label>
      {prefix && mode("tel") !== "off" ? (
        <label className="gf-field">
          {label("tel")}
          {star("tel")}
          <input className={`gf-input${isMissing(`${prefix}phone`) ? " is-missing" : ""}`} type="tel" autoComplete="off" value={p.phone} maxLength={40} onChange={(e) => set({ ...p, phone: e.target.value })} />
        </label>
      ) : null}
    </div>
  );

  const diet = (p, set, prefix, title) => (
    <div className={withPlus ? "gf-box" : "gf-set"}>
      {withPlus ? <div className="gf-box-title">{title}</div> : null}
      <Pills options={DIETS} value={p.diet} onChange={(v) => set({ ...p, diet: v })} label={`${label("regime")} : ${title}`} missing={isMissing(`${prefix}diet`)} />
      <label className="gf-field" style={{ marginTop: 6 }}>
        Allergies
        <input className="gf-input" placeholder="Ex. : fruits à coque" value={p.allergies} maxLength={200} onChange={(e) => set({ ...p, allergies: e.target.value })} />
      </label>
    </div>
  );

  const hint = (key) => {
    const text = key === "adresse" ? "Pour t'envoyer le faire-part et des mots doux." : null;
    return text ? <span className="gf-hint">{text}</span> : null;
  };

  // Une question de la présélection, dans l'ordre du couple
  const preset = (key) => {
    switch (key) {
      case "tel":
        return (
          <label key={key} className="gf-field">
            {label("tel")}
            {star("tel")}
            <input className={`gf-input${isMissing("phone") ? " is-missing" : ""}`} type="tel" autoComplete="tel" value={me.phone} maxLength={40} onChange={(e) => setMe({ ...me, phone: e.target.value })} />
          </label>
        );
      case "adresse":
        return (
          <label key={key} className="gf-field">
            {label("adresse")}
            {star("adresse")}
            {hint("adresse")}
            <input className={`gf-input${isMissing("address") ? " is-missing" : ""}`} autoComplete="street-address" placeholder="Numéro, rue, code postal, ville" value={me.address} maxLength={300} onChange={(e) => setMe({ ...me, address: e.target.value })} />
          </label>
        );
      case "presence":
        if (globalPresence) {
          return (
            <fieldset key={key} className="gf-set">
              <legend>Seras-tu des nôtres ?{star("presence")}</legend>
              <Pills options={YESNO} value={answers.all || null} label="Seras-tu des nôtres ?" missing={isMissing("ev:all")} onChange={(v) => setAnswers((a) => ({ ...a, all: v }))} />
            </fieldset>
          );
        }
        if (!events.length) return null;
        return (
          <fieldset key={key} className="gf-set">
            <legend>Seras-tu des nôtres ?{star("presence")}</legend>
            {events.map((e) => (
              <div key={e.id} className={`gf-row${isMissing(`ev:${e.id}`) ? " is-missing" : ""}`}>
                <span>{e.name}</span>
                <Pills options={YESNO} value={answers[e.id] || null} label={e.name} onChange={(v) => setAnswers((a) => ({ ...a, [e.id]: v }))} />
              </div>
            ))}
          </fieldset>
        );
      case "plusun":
        return (
          <fieldset key={key} className="gf-set">
            <legend>Viens-tu accompagné(e) ?{star("plusun")}</legend>
            <Pills options={YESNO} value={plus} label="Viens-tu accompagné(e) ?" onChange={setPlus} missing={isMissing("plus")} />
            {withPlus ? (
              <div className="gf-box">
                <div className="gf-box-title">Ton accompagnant(e)</div>
                {person(other, setOther, "p_")}
                {mode("adresse") !== "off" ? (
                  <>
                    <button type="button" className={`gf-check${other.same_address ? " is-on" : ""}`} aria-pressed={other.same_address} onClick={() => setOther({ ...other, same_address: !other.same_address })}>
                      <span>
                        {other.same_address ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                        ) : null}
                      </span>
                      Même adresse postale que moi
                    </button>
                    {!other.same_address ? (
                      <label className="gf-field">
                        {label("adresse")}
                        {star("adresse")}
                        <input className={`gf-input${isMissing("p_address") ? " is-missing" : ""}`} placeholder="Numéro, rue, code postal, ville" value={other.address} maxLength={300} onChange={(e) => setOther({ ...other, address: e.target.value })} />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        );
      case "regime":
        return (
          <fieldset key={key} className="gf-set">
            <legend>
              {label("regime")}
              {star("regime")}
            </legend>
            {diet(me, setMe, "", "Toi")}
            {withPlus ? diet(other, setOther, "p_", "Ton accompagnant(e)") : null}
          </fieldset>
        );
      case "enfants":
        return (
          <fieldset key={key} className="gf-set">
            <legend>
              {label("enfants")}
              {star("enfants")}
            </legend>
            <div className="gf-g2">
              <label className="gf-field">
                Combien d'enfants viennent avec toi ?
                <input className={`gf-input${isMissing("kids") ? " is-missing" : ""}`} type="number" min="0" max="12" inputMode="numeric" value={kids.count} onChange={(e) => setKids({ ...kids, count: e.target.value })} />
              </label>
              {Number(kids.count) > 0 ? (
                <label className="gf-field">
                  Leurs âges
                  <input className="gf-input" placeholder="Ex. : 5 et 8 ans" value={kids.ages} maxLength={100} onChange={(e) => setKids({ ...kids, ages: e.target.value })} />
                </label>
              ) : null}
            </div>
          </fieldset>
        );
      case "hebergement":
        return (
          <fieldset key={key} className="gf-set">
            <legend>
              {label("hebergement")}
              {star("hebergement")}
            </legend>
            <Pills options={YESNO} value={lodging} label={label("hebergement")} onChange={setLodging} missing={isMissing("lodging")} />
          </fieldset>
        );
      case "mot":
        return (
          <label key={key} className="gf-field">
            {label("mot")}
            {star("mot")}
            <textarea className={`gf-input${isMissing("note") ? " is-missing" : ""}`} rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        );
      default:
        return null;
    }
  };

  const customQ = (c) =>
    c.type === "text" ? (
      <label key={c.id} className="gf-field">
        {c.label}
        {c.req ? " *" : ""}
        <input className={`gf-input${isMissing(`c:${c.id}`) ? " is-missing" : ""}`} value={custom[c.id] || ""} maxLength={500} onChange={(e) => setCustom({ ...custom, [c.id]: e.target.value })} />
      </label>
    ) : (
      <fieldset key={c.id} className="gf-set">
        <legend>
          {c.label}
          {c.req ? " *" : ""}
        </legend>
        <Pills options={c.type === "yesno" ? YESNO : c.options || []} value={custom[c.id] || null} label={c.label} missing={isMissing(`c:${c.id}`)} onChange={(v) => setCustom({ ...custom, [c.id]: v })} />
      </fieldset>
    );

  const questions = formQuestions(form);
  // Le titre « Tes informations » coiffe le bloc prénom, nom et mail ; s'il n'ouvre pas le formulaire, « Ta réponse » le fait
  const identFirst = questions[0]?.kind === "ident";

  const errorText = {
    full: "La liste des mariés est complète : contacte-les directement.",
    closed: "La date limite de réponse est passée : contacte directement les mariés.",
    busy: "Beaucoup de réponses arrivent en ce moment : réessaie dans une heure.",
    failed: "Ta réponse n'a pas pu être envoyée. Vérifie ta connexion et réessaie.",
  };

  return (
    <form
      ref={root}
      className="gf-card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {done && !done.error ? (
        <div className="gf-done gf-done-ok" role="status">
          <strong>Merci, c'est noté.</strong>
          <span>
            Ta réponse est arrivée chez les mariés. Pour la changer, renvoie simplement le formulaire avec les mêmes prénom et nom.
          </span>
        </div>
      ) : closed ? (
        <div className="gf-done" role="status">
          <strong>Les réponses sont closes.</strong>
          <span>La date limite était le {dayMonth(form.deadline)}. Pour répondre quand même, écris directement aux mariés.</span>
        </div>
      ) : (
        <>
          <div className="gf-head">
            <h2>{identFirst ? "Tes informations" : "Ta réponse"}</h2>
            <p>
              {form.deadline ? `Merci de répondre avant le ${dayMonth(form.deadline)}. ` : ""}Les champs marqués d'un astérisque sont obligatoires.
            </p>
          </div>

          {questions.map((q) => {
            if (q.kind === "ident") {
              return (
                <div key={q.id} className="gf-set">
                  {identFirst ? null : <div className="gf-legend">Tes informations</div>}
                  {person(me, setMe, "")}
                </div>
              );
            }
            if (q.kind === "custom") return customQ(q.custom);
            return preset(q.key);
          })}

          {live?.size ? (
            <div id="gf-missing" className="gf-missing" role="alert">
              Il manque encore : {check().map((m) => m.text).join(", ")}.
            </div>
          ) : null}
          {done?.error ? (
            <div className="gf-missing" role="alert">
              {errorText[done.error] || errorText.failed}
            </div>
          ) : null}
          <button type="submit" className="gf-send" disabled={sending}>
            {sending ? "Envoi…" : "Envoyer ma réponse"}
          </button>
        </>
      )}
    </form>
  );
}
