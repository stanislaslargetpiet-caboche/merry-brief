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

function readDemoSite(slug) {
  try {
    const raw = window.localStorage.getItem("merry-demo-v1");
    const data = raw ? JSON.parse(raw)?.data : null;
    if (!data?.site || data.site.slug !== slug) return null;
    if (data.site.published === false) return { closed: true, partner1: data.wedding.partner1, partner2: data.wedding.partner2 };
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

export default function WeddingSitePage() {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, site: null });

  useEffect(() => {
    let live = true;
    (async () => {
      const demo = readDemoSite(String(slug));
      if (demo || !supabase) {
        if (live) setState({ loading: false, site: demo });
        return;
      }
      const { data, error } = await supabase.rpc("merry_site_public", { site_slug: String(slug) });
      if (error) console.error("[merry] site de mariage", error);
      if (live) setState({ loading: false, site: data || null });
    })();
    return () => {
      live = false;
    };
  }, [slug]);

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
      <link rel="stylesheet" href={fontsHref([fonts])} />
      <main className="s-public">
        <SiteView site={site} wedding={{ partner1: site.partner1, partner2: site.partner2, wedding_date: site.wedding_date, venue: site.venue, region: site.region }} events={site.events || []} formSlug={site.form_slug || null} />
      </main>
    </>
  );
}
