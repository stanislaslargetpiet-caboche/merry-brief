"use client";

import { useEffect, useState } from "react";
import { supabase, flushPendingBrief } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

/*
 * Page d'attente du tableau de bord : connexion, lecture du brief du compte,
 * et premier aperçu. Le vrai dashboard (budget, invités, prestataires)
 * viendra remplacer cette page.
 */

const LABELS = {
  stage: { debut: "Au tout début", regarde: "On commence à s'y pencher", lieu_recherche: "Recherche du lieu", lieu_reserve: "Lieu réservé", details: "Derniers détails" },
  team: { nous_deux: "Juste vous deux", nous_parents: "Vous et vos parents", nous_planner: "Vous et un wedding planner", planner_seul: "Un wedding planner" },
  guests: { "<50": "Moins de 50 invités", "50-100": "50 à 100 invités", "100-150": "100 à 150 invités", "150-200": "150 à 200 invités", ">200": "Plus de 200 invités" },
  budget: { "<15k": "Moins de 15 000 €", "15-30k": "15 000 à 30 000 €", "30-50k": "30 000 à 50 000 €", ">50k": "Plus de 50 000 €", aucune_idee: "Budget à définir" },
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUser(data?.user || null);
    if (data?.user) {
      // Brouillon laissé en attente d'une confirmation d'email ?
      try {
        const pending = window.localStorage.getItem("merry-brief-pending");
        if (pending) {
          const res = await flushPendingBrief(JSON.parse(pending));
          if (res.ok) window.localStorage.removeItem("merry-brief-pending");
        }
      } catch {
        /* ignore */
      }
      const { data: rows } = await supabase.from("briefs").select("*").order("created_at", { ascending: false }).limit(1);
      setBrief(rows?.[0] || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    setLoading(true);
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setBrief(null);
  }

  return (
    <div className="shell">
      <aside className="panel">
        <a className="panel-logo" href={SITE_URL} aria-label="Merry, retour au site">Merry</a>
        <div className="panel-word" aria-hidden="true">Ton mariage.</div>
        <div className="panel-caption" aria-hidden="true">Merry - Experience Crafting Group</div>
      </aside>
      <main className="stage">
        {!supabase ? (
          <section className="card">
            <h1 className="question">Tableau de bord</h1>
            <p className="help">Supabase n'est pas configuré sur cet environnement. Ajoute les variables dans .env.local pour activer les comptes.</p>
          </section>
        ) : loading ? (
          <section className="card"><p className="help">Chargement…</p></section>
        ) : !user ? (
          <section className="card">
            <div className="eyebrow">Connexion</div>
            <h1 className="question">Content de te revoir.</h1>
            <form onSubmit={signIn} className="fields">
              <div className="field full">
                <label htmlFor="login-email">Email</label>
                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <div className="field full">
                <label htmlFor="login-password">Mot de passe</label>
                <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              {error ? <p className="error">{error}</p> : null}
              <div className="actions" style={{ gridColumn: "1 / -1" }}>
                <a className="skip" href="/">Pas encore de compte ? Commencer</a>
                <button type="submit" className="btn">Se connecter</button>
              </div>
            </form>
          </section>
        ) : (
          <section className="card">
            <div className="eyebrow">Tableau de bord</div>
            <h1 className="question">
              {brief ? `${brief.first_name} et ${brief.partner_first_name}` : "Bienvenue"}
            </h1>
            {brief ? (
              <>
                <p className="help">
                  {LABELS.stage[brief.stage] || brief.stage} · {LABELS.team[brief.team] || brief.team} · {LABELS.guests[brief.guests] || brief.guests} · {LABELS.budget[brief.budget] || brief.budget}
                  {brief.region ? ` · ${brief.region}` : ""}
                  {brief.wedding_date ? ` · ${new Date(brief.wedding_date).toLocaleDateString("fr-FR")}` : ""}
                </p>
                <div className="choices">
                  {(brief.vibes || []).map((v) => <span key={v} className="chip" aria-pressed="true">{v}</span>)}
                </div>
                <p className="help">Le budget, la liste d'invités et les premières propositions de lieux arrivent ici. En attendant, Camille lit votre brief.</p>
              </>
            ) : (
              <p className="help">Aucun brief trouvé pour ce compte. <a href="/">Remplir le brief</a>.</p>
            )}
            <div className="actions">
              <button type="button" className="skip" onClick={signOut}>Se déconnecter</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
