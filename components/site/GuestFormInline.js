"use client";

// Formulaire RSVP intégré directement dans la rubrique « Votre réponse » du site de mariage,
// au lieu d'un lien vers /f/[slug] : l'invité répond sans quitter le site. Mêmes champs, même
// logique d'envoi et de rappel (RESPONSE_KEY) que la page publique du formulaire (app/f/[slug]/page.js),
// extraits ici pour être réutilisés par chaque modèle de site via Reponse (voir Horizon, Terracotta,
// Perle, Colline, Rivage).

import "@/app/f/form.css";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DIETS, fieldLabel, fieldMode, formTheme, withPresets } from "@/lib/dash/form";
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

export default function GuestFormInline({ formSlug, preview, onAnswered }) {
  const [state, setState] = useState({ status: "loading", form: null });
  const [me, setMe] = useState(EMPTY_PERSON);
  const [plus, setPlus] = useState(null);
  const [other, setOther] = useState({ ...EMPTY_PERSON, same_address: true });
  const [answers, setAnswers] = useState({});
  const [kids, setKids] = useState({ count: "", ages: "" });
  const [lodging, setLodging] = useState(null);
  const [custom, setCustom] = useState({});
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let form = null;
      if (!preview && supabase) {
        const { data, error } = await supabase.rpc("merry_form_public", { form_slug: String(formSlug) });
        if (error) console.error("[merry] formulaire", error);
        form = data || null;
      }
      if (!form) form = readDemoForm(String(formSlug));
      if (alive) setState(form ? { status: "ready", form: withPresets(form) } : { status: "missing", form: null });
    })();
    return () => {
      alive = false;
    };
  }, [formSlug, preview]);

  const form = state.form;
  const theme = formTheme(form?.theme);
  const mode = (key) => (form ? fieldMode(form, key) : "off");
  const label = (key) => (form ? fieldLabel(form, key) : "");
  const star = (key) => (mode(key) === "req" ? " *" : "");
  let live = null;
  const isMissing = (k) => !!live?.has(k);
  const style = useMemo(() => ({ "--gf-bg": theme.bg, "--gf-accent": theme.accent }), [theme]);

  if (state.status !== "ready") {
    return <p className="gf-state">{state.status === "loading" ? "Chargement du formulaire…" : "Ce formulaire n'existe pas ou n'est plus ouvert."}</p>;
  }

  const globalPresence = form.presence_mode === "global";
  const events = form.events || [];
  const withPlus = mode("plusun") !== "off" && plus === "oui";

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
      if (globalPresence) need("ev:all", answers.all, "Serez-vous des nôtres ?");
      else for (const e of events) need(`ev:${e.id}`, answers[e.id], e.name);
    }
    if (mode("plusun") === "req") need("plus", plus, label("plusun"));
    if (withPlus) {
      need("p_first_name", other.first_name.trim(), "Prénom de l'accompagnant");
      need("p_last_name", other.last_name.trim(), "Nom de l'accompagnant");
      need("p_email", EMAIL_RE.test(other.email.trim()), "Mail de l'accompagnant");
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

  live = missing.length ? new Set(check().map((m) => m.key)) : null;

  async function submit() {
    const miss = check();
    setMissing(miss.map((m) => m.key));
    if (miss.length) {
      document.getElementById("gf-missing")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    const remember = () => {
      try {
        const names = [`${me.first_name} ${me.last_name}`.trim(), withPlus ? `${other.first_name} ${other.last_name}`.trim() : ""].filter(Boolean);
        const yes = events.filter((e) => payload.answers[e.id] === "oui").map((e) => e.name);
        const answered = Object.values(payload.answers).filter(Boolean);
        window.localStorage.setItem(
          RESPONSE_KEY(String(formSlug)),
          JSON.stringify({ names: names.length > 1 ? `${names[0]} et ${names[1]}` : names[0], moments: yes.map((n, i) => (i ? n.charAt(0).toLowerCase() + n.slice(1) : n)), present: answered.length ? yes.length > 0 : null, at: new Date().toISOString() }),
        );
      } catch {
        // stockage indisponible : le site invitera simplement à répondre
      }
    };
    setSending(true);
    if (form.demo || !supabase) {
      remember();
      setDone({ known: false });
      setSending(false);
      onAnswered?.();
      return;
    }
    const { data, error } = await supabase.rpc("merry_form_submit", { form_slug: String(formSlug), payload });
    setSending(false);
    if (error) {
      console.error("[merry] envoi du formulaire", error);
      setMissing([]);
      setDone({ error: /Liste complète/.test(error.message || "") ? "full" : "failed" });
      return;
    }
    remember();
    setDone({ known: !!data?.known });
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
        Mail *
        <input className={`gf-input${isMissing(`${prefix}email`) ? " is-missing" : ""}`} type="email" autoComplete={prefix ? "off" : "email"} value={p.email} maxLength={200} onChange={(e) => set({ ...p, email: e.target.value })} />
      </label>
      {mode("tel") !== "off" ? (
        <label className="gf-field">
          {label("tel")}
          {star("tel")}
          <input className={`gf-input${isMissing(`${prefix}phone`) ? " is-missing" : ""}`} type="tel" autoComplete={prefix ? "off" : "tel"} value={p.phone} maxLength={40} onChange={(e) => set({ ...p, phone: e.target.value })} />
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

  return (
    <div className="gf-embed" style={style}>
      <form
        className="gf-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {done && !done.error ? (
          <div className="gf-done" role="status">
            <strong>Merci, c'est noté.</strong>
            <span>
              {done.known ? "Votre réponse a mis à jour votre ligne dans la liste des mariés." : "Votre réponse est arrivée chez les mariés."} Pour changer une réponse, renvoyez simplement le formulaire avec les mêmes prénom et nom.
            </span>
          </div>
        ) : (
          <>
            <div className="gf-head">
              <h2>Vos informations</h2>
              <p>Les champs marqués d'un astérisque sont obligatoires.</p>
            </div>

            {person(me, setMe, "")}

            {mode("adresse") !== "off" ? (
              <label className="gf-field">
                {label("adresse")}
                {star("adresse")}
                <span className="gf-hint">Pour vous envoyer le faire-part et des mots doux.</span>
                <input className={`gf-input${isMissing("address") ? " is-missing" : ""}`} autoComplete="street-address" placeholder="Numéro, rue, code postal, ville" value={me.address} maxLength={300} onChange={(e) => setMe({ ...me, address: e.target.value })} />
              </label>
            ) : null}

            {mode("presence") !== "off" && globalPresence ? (
              <fieldset className="gf-set">
                <legend>Serez-vous des nôtres ?{star("presence")}</legend>
                <Pills options={YESNO} value={answers.all || null} label="Serez-vous des nôtres ?" missing={isMissing("ev:all")} onChange={(v) => setAnswers((a) => ({ ...a, all: v }))} />
              </fieldset>
            ) : null}

            {mode("presence") !== "off" && !globalPresence && events.length ? (
              <fieldset className="gf-set">
                <legend>Serez-vous des nôtres ?{star("presence")}</legend>
                {events.map((e) => (
                  <div key={e.id} className={`gf-row${isMissing(`ev:${e.id}`) ? " is-missing" : ""}`}>
                    <span>{e.name}</span>
                    <Pills options={YESNO} value={answers[e.id] || null} label={e.name} onChange={(v) => setAnswers((a) => ({ ...a, [e.id]: v }))} />
                  </div>
                ))}
              </fieldset>
            ) : null}

            {mode("plusun") !== "off" ? (
              <fieldset className="gf-set">
                <legend>Venez-vous accompagné(e) ?{star("plusun")}</legend>
                <Pills options={YESNO} value={plus} label="Venez-vous accompagné(e) ?" onChange={setPlus} missing={isMissing("plus")} />
                {withPlus ? (
                  <div className="gf-box">
                    <div className="gf-box-title">Votre accompagnant(e)</div>
                    {person(other, setOther, "p_")}
                    {mode("adresse") !== "off" ? (
                      <>
                        <button type="button" className={`gf-check${other.same_address ? " is-on" : ""}`} aria-pressed={other.same_address} onClick={() => setOther({ ...other, same_address: !other.same_address })}>
                          <span>
                            {other.same_address ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            ) : null}

            {mode("regime") !== "off" ? (
              <fieldset className="gf-set">
                <legend>
                  {label("regime")}
                  {star("regime")}
                </legend>
                {diet(me, setMe, "", "Vous")}
                {withPlus ? diet(other, setOther, "p_", "Votre accompagnant(e)") : null}
              </fieldset>
            ) : null}

            {mode("enfants") !== "off" ? (
              <fieldset className="gf-set">
                <legend>
                  {label("enfants")}
                  {star("enfants")}
                </legend>
                <div className="gf-g2">
                  <label className="gf-field">
                    Combien d'enfants viennent avec vous ?
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
            ) : null}

            {mode("hebergement") !== "off" ? (
              <fieldset className="gf-set">
                <legend>
                  {label("hebergement")}
                  {star("hebergement")}
                </legend>
                <Pills options={YESNO} value={lodging} label={label("hebergement")} onChange={setLodging} missing={isMissing("lodging")} />
              </fieldset>
            ) : null}

            {form.custom.map((c) =>
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
              ),
            )}

            {mode("mot") !== "off" ? (
              <label className="gf-field">
                {label("mot")}
                {star("mot")}
                <textarea className={`gf-input${isMissing("note") ? " is-missing" : ""}`} rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            ) : null}

            {live?.size ? (
              <div id="gf-missing" className="gf-missing" role="alert">
                Il manque encore : {check().map((m) => m.text).join(", ")}.
              </div>
            ) : null}
            {done?.error ? (
              <div className="gf-missing" role="alert">
                {done.error === "full" ? "La liste des mariés est complète : contactez-les directement." : "Votre réponse n'a pas pu être envoyée. Vérifiez votre connexion et réessayez."}
              </div>
            ) : null}
            <button type="submit" className="gf-send" disabled={sending}>
              {sending ? "Envoi…" : "Envoyer ma réponse"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
