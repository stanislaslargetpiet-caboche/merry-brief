"use client";

// Espace Invités, onglet « Site de mariage » (artboards « 10b · Invités : Site de mariage » et « 10n », téléphone) :
// l'aperçu du site, son état, son lien, puis « Personnaliser le site » qui ouvre l'éditeur plein écran (9b).

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { guestStats } from "@/lib/dash/model";
import { defaultSite, fontsHref, fontsOf, siteUrl } from "@/lib/site/model";
import { Btn } from "@/components/dash/ui";
import InvitesHeader from "@/components/dash/InvitesTabs";

export default function InvitesSite() {
  const data = useDash().data;
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const site = data.site || defaultSite(data);
  const fonts = fontsOf(site);
  const g = guestStats(data);

  // L'adresse complète dépend du domaine : connue seulement dans le navigateur
  useEffect(() => {
    if (data.site) setUrl(siteUrl(data.site.slug));
  }, [data.site]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copiez le lien :", url);
    }
  };

  const status = !data.site ? (
    <span className="d-itab-online is-off">Pas encore créé</span>
  ) : (
    <span className={`d-itab-online${data.site.published ? "" : " is-off"}`}>{data.site.published ? "En ligne" : "Hors ligne"}</span>
  );

  return (
    <>
      <link rel="stylesheet" href={fontsHref([fonts])} />
      <InvitesHeader
        tab="site"
        actions={
          <Btn href="/dashboard/site">
            Personnaliser le site
          </Btn>
        }
      />

      <section className="d-isite">
        <div className="d-isite-body">
          {status}
          <h2>Votre site de mariage</h2>
          <p className="d-muted">
            Vos invités y trouvent <span className="d-isite-hl">le programme</span>, <span className="d-isite-hl">le lieu</span> et{" "}
            <span className="d-isite-hl">le formulaire</span> pour répondre. Chaque réponse arrive dans votre liste.
          </p>
          {data.site ? (
            <div className="d-isite-url">
              <span>{url.replace(/^https?:\/\//, "")}</span>
              <button type="button" className="d-btn d-btn-ghost d-btn-small" onClick={copy}>
                {copied ? "Lien copié" : "Copier le lien"}
              </button>
            </div>
          ) : null}
          <div className="d-isite-actions">
            <Btn href="/dashboard/site">
              {data.site ? "Personnaliser le site" : "Créer le site"}
            </Btn>
            {data.site?.published ? (
              <a className="d-btn d-btn-ghost" href={`/s/${data.site.slug}`} target="_blank" rel="noreferrer">
                Voir le site
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className="d-isite-cards">
        <Link href="/dashboard/invites" className="d-isite-card">
          <strong>{g.total - g.answered}</strong>
          <span>Invités sans réponse</span>
          <small>À relancer avec le lien du site</small>
        </Link>
      </div>
    </>
  );
}
