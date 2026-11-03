// Mise en page commune des pages juridiques du site (confidentialité, conditions d'utilisation)

import Frame from "@/components/vitrine/Frame";

export default function Legal({ title, updated, intro, sections }) {
  return (
    <Frame current="legal">
      <section className="wv-legal">
        <h1 className="wv-h1">{title}</h1>
        <p className="wv-p wv-legal-date">Dernière mise à jour : {updated}</p>
        {intro ? <p className="wv-lead">{intro}</p> : null}
        {sections.map(([heading, paragraphs]) => (
          <section key={heading} className="wv-block">
            <h2 className="wv-h4">{heading}</h2>
            {paragraphs.map((p, i) =>
              Array.isArray(p) ? (
                <ul key={i} className="wv-p">
                  {p.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="wv-p">
                  {p}
                </p>
              ),
            )}
          </section>
        ))}
      </section>
    </Frame>
  );
}
