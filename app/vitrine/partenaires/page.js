import Frame, { Block } from "@/components/vitrine/Frame";
import { DEMO, PRO } from "@/lib/vitrine/routes";
import avantApres from "@/lib/vitrine/blocks/pro-avant-apres";
import criteres from "@/lib/vitrine/blocks/pro-criteres";
import credits from "@/lib/vitrine/blocks/pro-credits";
import fiche from "@/lib/vitrine/blocks/pro-fiche";

export const metadata = {
  title: "Prestataires — Merry",
  description: "Des demandes de mariage qualifiées, sans abonnement ni commission : vous ne payez en crédits que les demandes auxquelles vous répondez. 100 crédits offerts.",
  alternates: { canonical: "https://www.withmerry.com/partenaires" },
};

const FAQ = [
  ["Est-ce payant de recevoir des demandes ?", "Non, vous ne dépensez des crédits que pour répondre."],
  ["Dois-je répondre à toutes les demandes ?", "Non, vous choisissez."],
  ["Prenez-vous une commission ?", "Non, jamais."],
  ["Combien de temps pour ma fiche ?", "3 minutes."],
];

const Cta = ({ lime }) => (
  <a href={PRO} className={`wv-btn ${lime ? "wv-btn-lime" : "wv-btn-dark"}`}>
    Compléter ma fiche
  </a>
);

export default async function VitrinePrestataires() {
  return (
    <Frame current="pro">
      <section className="wv-sec wv-lime wv-center" aria-label="Prestataires" style={{ gap: 28 }}>
        <h1 className="wv-h3" style={{ maxWidth: 1100 }}>
          Plus de demandes qualifiées. Moins de temps perdu.
        </h1>
        <p className="wv-lead" style={{ maxWidth: 760 }}>
          Les couples décrivent leur mariage ; Merry vous envoie ceux qui vous correspondent et vous choisissez de répondre aux demandes ou non.
        </p>
        <Block html={avantApres} className="wv-media wv-media-mid" />
        <div className="wv-btns" style={{ justifyContent: "center" }}>
          <Cta />
          <a href={DEMO} className="wv-btn wv-btn-line">
            Réserver une démo
          </a>
        </div>
      </section>

      <section className="wv-sec wv-split" aria-label="Les demandes">
        <Block html={criteres} className="wv-media" />
        <div className="wv-stack">
          <h2 className="wv-h3">Vous voyez tout avant de répondre.</h2>
          <div className="wv-steps">
            <p>Le couple remplit son brief : date, lieu, invités, budget, style.</p>
            <p>Merry vous le propose s’il correspond à vos critères.</p>
            <p>Vous lisez la demande et choisissez d’y répondre ou non.</p>
          </div>
          <div className="wv-btns">
            <Cta />
          </div>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-credits" aria-label="Les crédits">
        <div className="wv-stack">
          <h2 className="wv-h3">Pas d’abonnement. Pas de commission.</h2>
          <p className="wv-lead">Voir les demandes est gratuit. Vous utilisez des crédits seulement pour répondre : de 8 à 25 selon votre métier.</p>
          <p className="wv-lead">100 crédits offerts à l’inscription, soit 4 à 12 demandes.</p>
        </div>
        <Block html={credits} className="wv-media" />
      </section>

      <section className="wv-sec wv-split" aria-label="Votre fiche">
        <Block html={fiche} className="wv-media" />
        <div className="wv-stack">
          <h2 className="wv-h3">Votre fiche existe peut-être déjà.</h2>
          <p className="wv-lead">Retrouvez votre établissement, ajoutez photos, prix et capacité : c’est ce qui vous permettra de recevoir enfin des demandes qualifiées. 3 minutes maximum.</p>
          <div className="wv-btns">
            <Cta />
          </div>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-two" aria-labelledby="wv-faq-pro">
        <h2 id="wv-faq-pro" className="wv-h3">
          FAQ.
        </h2>
        <div className="wv-acc wv-acc-small">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="wv-sec wv-black wv-end" aria-label="Commencer">
        <ul>
          <li>Fini le référencement payant.</li>
          <li>Finies les marketplaces à rallonge.</li>
          <li>Finies les demandes sans réponse.</li>
        </ul>
        <div className="wv-stack">
          <h2 className="wv-h2">Commencez à gagner du temps.</h2>
          <div className="wv-btns">
            <Cta lime />
          </div>
        </div>
      </section>
    </Frame>
  );
}
