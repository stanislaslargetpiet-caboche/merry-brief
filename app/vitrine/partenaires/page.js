import Frame, { Block } from "@/components/vitrine/Frame";
import { DEMO, PRO } from "@/lib/vitrine/routes";
import avantApres from "@/lib/vitrine/blocks/pro-avant-apres";
import criteres from "@/lib/vitrine/blocks/pro-criteres";
import credits from "@/lib/vitrine/blocks/pro-credits";
import fiche from "@/lib/vitrine/blocks/pro-fiche";

export const metadata = {
  title: "Prestataires | Merry",
  description: "Recevez beaucoup plus de demandes de mariage qualifiées, sans abonnement ni commission : vous lisez tout gratuitement et utilisez des crédits seulement pour répondre. 100 crédits offerts.",
  alternates: { canonical: "https://www.withmerry.com/partenaires" },
};

// Planche « Site-Prestataires » du canvas « 9 - Site vitrine » (30 oct. 2026)
const FICHE = `${PRO}/fiche`;

const COMPARATIF = [
  ["Votre budget", "Un abonnement, avec ou sans demandes", "Des crédits, seulement quand vous répondez"],
  ["Ce que vous recevez", "« Vous êtes libres cet été ? Vos prix ? »", "Date, lieu, invités, budget et style, avant de répondre"],
  ["Qui vous écrit", "Tous les couples de la région", "Les couples qui vous correspondent"],
  ["Commission", "Selon la plateforme", "Jamais"],
  ["Si ça ne marche pas", "L’abonnement est payé", "Garantie Merry : vos crédits offerts sont recrédités"],
];

const FAQ = [
  ["Est-ce payant de recevoir des demandes ?", "Non, vous ne dépensez des crédits que pour répondre."],
  ["Dois-je répondre à toutes les demandes ?", "Non, vous choisissez."],
  ["Prenez-vous une commission ?", "Non, jamais."],
  ["Combien de temps pour ma fiche ?", "3 minutes."],
];

const Cta = () => (
  <a href={PRO} className="wv-btn wv-btn-dark">
    Compléter ma fiche
  </a>
);

export default async function VitrinePrestataires() {
  return (
    <Frame current="pro">
      <section className="wv-sec wv-lime wv-center" aria-label="Prestataires" style={{ gap: 28 }}>
        <h1 className="wv-h2" style={{ maxWidth: 1100 }}>
          Recevez beaucoup plus de demandes qualifiées.
        </h1>
        <p className="wv-lead" style={{ maxWidth: 820 }}>
          Date, lieu, budget, nombre d’invités, style : vous lisez tout, gratuitement, avant de répondre. Fini les « vous êtes libres cet été ? ».
        </p>
        <form className="wv-find" action={FICHE} method="get">
          <label className="wv-find-in">
            <span className="wv-sr">Le nom de votre établissement</span>
            <input type="search" name="etablissement" placeholder="Le nom de votre établissement" autoComplete="organization" />
          </label>
          <button type="submit" className="wv-btn wv-btn-dark">
            Retrouver ma fiche
          </button>
        </form>
        <p className="wv-find-note">Près de 15 000 prestataires sont déjà référencés sur Merry (octobre 2026). Votre fiche existe peut-être déjà.</p>
        <Block html={avantApres} className="wv-media wv-media-wide" />
        <p className="wv-lead" style={{ maxWidth: 620 }}>
          Pas encore sur Merry ? Créez votre fiche, ça prend 3 minutes.
        </p>
        <div className="wv-btns" style={{ justifyContent: "center" }}>
          <a href={PRO} className="wv-btn wv-btn-line">
            Compléter ma fiche
          </a>
          <a href={DEMO} className="wv-btn wv-btn-line">
            Réserver une démo
          </a>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-credits" aria-label="Les crédits">
        <div className="wv-stack">
          <h2 className="wv-h3">100 crédits offerts à l’inscription.</h2>
          <p className="wv-lead">Pas d’abonnement, pas de commission. Voir les demandes est gratuit.</p>
          <p className="wv-lead">Vous utilisez des crédits seulement pour répondre : de 8 à 25 selon votre métier, soit 4 à 12 demandes avec les crédits offerts.</p>
        </div>
        <Block html={credits} className="wv-media" />
      </section>

      <section className="wv-sec wv-cmp-sec" aria-labelledby="wv-cmp-t">
        <h2 id="wv-cmp-t" className="wv-h3">
          Annuaire payant ou Merry : ce qui change vraiment.
        </h2>
        <div className="wv-cmp" role="table">
          <div className="wv-cmp-row wv-cmp-head" role="row">
            <span role="columnheader" />
            <span role="columnheader">Annuaire payant</span>
            <span role="columnheader">Merry</span>
          </div>
          {COMPARATIF.map(([k, a, b]) => (
            <div key={k} className="wv-cmp-row" role="row">
              <span role="rowheader">{k}</span>
              <span role="cell">{a}</span>
              <span role="cell">{b}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="wv-sec wv-split wv-split-big" aria-label="Les demandes">
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

      <section className="wv-sec wv-black wv-guar" aria-label="Garantie Merry">
        <p className="wv-guar-k">Garantie Merry</p>
        <h2 className="wv-h3">Pas de réservation avec vos 100 crédits offerts ? On vous les recrédite.</h2>
        <p className="wv-lead">Vous essayez Merry sans rien risquer : si aucune de vos réponses ne débouche sur une réservation, vos crédits offerts reviennent sur votre compte.</p>
      </section>

      <section className="wv-sec wv-split wv-split-big" aria-label="Votre fiche">
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
          <h2 className="wv-h3">Retrouvez votre fiche en 3 minutes.</h2>
          <div className="wv-btns">
            <a href={FICHE} className="wv-btn wv-btn-lime">
              Revendiquer ma fiche
            </a>
            <a href={DEMO} className="wv-btn wv-btn-line">
              Réserver une démo
            </a>
          </div>
          <p className="wv-lead">100 crédits offerts à l’inscription.</p>
        </div>
      </section>
    </Frame>
  );
}
