"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fontsHref, fontsOf } from "@/lib/site/model";
import SiteView from "@/components/site/SiteView";

/*
 * Page publique du site de mariage : le lien que le couple donne à ses invités.
 * Aucune connexion : le site est lu par une fonction Supabase (merry_site_public).
 * En démo (tableau de bord ?demo=1 ou sans Supabase), on lit le site du navigateur.
 */

// Journalise une visite comme le fait merry_site_public côté serveur (supabase/site-visites.sql),
// pour que le compteur du tableau de bord ait quelque chose de réel à montrer en démo aussi.
function logDemoVisit(raw, data) {
  try {
    const visits = [...(data.site.visits || []), new Date().toISOString()].slice(-200);
    const next = { ...JSON.parse(raw), data: { ...data, site: { ...data.site, visits } } };
    window.localStorage.setItem("merry-demo-v1", JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function visitorId() {
  try {
    const key = "merry-visitor";
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

function readDemoSite(slug) {
  try {
    const raw = window.localStorage.getItem("merry-demo-v1");
    const data = raw ? JSON.parse(raw)?.data : null;
    if (!data?.site || data.site.slug !== slug) return null;
    if (data.site.published === false) return { closed: true, partner1: data.wedding.partner1, partner2: data.wedding.partner2 };
    logDemoVisit(raw, data);
    return {
      ...data.site,
      partner1: data.wedding.partner1,
      partner2: data.wedding.partner2,
      wedding_date: data.wedding.wedding_date,
      venue: data.wedding.venue,
      region: data.wedding.region,
      events: data.events,
      form_slug: data.form?.published ? data.form.slug : null,
    };
  } catch {
    return null;
  }
}

export default function WeddingSitePage({ slug: slugProp, initial = null }) {
  const params = useParams();
  const slug = String(slugProp ?? params?.slug ?? "");
  // Rendu tout de suite avec ce que le serveur a lu ; sinon chargement dans le navigateur
  const [state, setState] = useState({ loading: !initial, site: initial });

  useEffect(() => {
    let live = true;
    (async () => {
      // La démo du navigateur passe devant (tableau de bord ?demo=1)
      const demo = readDemoSite(slug);
      if (demo) {
        if (live) setState({ loading: false, site: demo });
        return;
      }
      let data = initial;
      if (!data) {
        if (!supabase) {
          if (live) setState({ loading: false, site: null });
          return;
        }
        const res = await supabase.rpc("merry_site_public", { site_slug: slug });
        if (res.error) console.error("[merry] site de mariage", res.error);
        data = res.data || null;
        if (live) setState({ loading: false, site: data });
      }
      // Une visite par personne et par heure (jeton anonyme gardé dans ce navigateur), comptée à part de la
      // lecture : l'aperçu de lien du serveur et les robots des messageries ne gonflent pas le compteur
      if (data && !data.closed && supabase) supabase.rpc("merry_site_visit", { site_slug: slug, visitor_id: visitorId() }).then(() => {}, () => {});
    })();
    return () => {
      live = false;
    };
  }, [slug, initial]);

  const site = state.site;
  const fonts = site && !site.closed ? fontsOf(site) : null;

  if (state.loading) return <main className="s-status" aria-busy="true" />;
  if (!site || site.closed) {
    const names = site ? [site.partner1, site.partner2].filter(Boolean).map((n) => String(n).trim().split(/\s+/)[0]).join(" & ") : "";
    return (
      <main className="s-status">
        <div>
          {names ? <strong>{names}</strong> : null}
          <p>{site?.closed ? "Ce site n’est pas encore ouvert. Revenez bientôt." : "Ce site de mariage n’existe pas, ou son adresse a changé. Vérifiez le lien reçu."}</p>
        </div>
      </main>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" precedence="default" href={fontsHref([fonts])} />
      <main className="s-public">
        <SiteView site={site} wedding={{ partner1: site.partner1, partner2: site.partner2, wedding_date: site.wedding_date, venue: site.venue, region: site.region }} events={site.events || []} formSlug={site.form_slug || null} />
      </main>
    </>
  );
}
