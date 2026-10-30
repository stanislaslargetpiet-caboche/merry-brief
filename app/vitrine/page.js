import Frame, { Block, getLinks } from "@/components/vitrine/Frame";
import { LOGIN, SIGNUP } from "@/lib/vitrine/routes";
import proposition from "@/lib/vitrine/blocks/proposition";
import carrousel from "@/lib/vitrine/blocks/carrousel";

const FAQ = [
  ["Quels événements je peux organiser avec Merry ?", "Un mariage, des vacances entre amis, un anniversaire, un séminaire : tout événement qui demande des prestataires, des invités et un budget."],
  ["Merry choisit les prestataires à ma place ?", "Non. On te montre toujours plusieurs options, on te dit ce que chacune coûte, et c’est toi qui choisis."],
  ["Je peux organiser à plusieurs ?", "Oui. Tu peux inviter ton conjoint, tes parents, tes amis ou tes collègues comme co-organisateurs. Ils accèdent à tout comme toi : invités, budget, rétroplanning et documents."],
  ["Je peux payer mes prestataires depuis Merry ?", "Tu suis tous tes paiements au même endroit : qui a payé quoi, et ce qu’il reste à régler. Le paiement direct depuis Merry arrive ensuite."],
  ["Comment mes invités retrouvent la page de la fête ?", "Ils entrent les prénoms de ceux qui organisent et la date, ou ton code d’invitation. Ils retrouvent alors la page de la fête, la cagnotte ou la liste de cadeaux, et toutes les infos pratiques."],
];

export default async function VitrineAccueil() {
  const links = await getLinks();
  return (
    <Frame current="home">
      <section className="wv-hero" aria-label="Accueil">
        <div className="wv-hero-in">
          <h1 className="wv-h2">Organiser un événement devrait être (très) simple.</h1>
          <p className="wv-lead">
            Merry : l’assistant qui <b>simplifie</b> l’organisation de tous tes événements de A à Z.
          </p>
          <div className="wv-btns">
            <a href={SIGNUP} className="wv-btn wv-btn-lime">
              J'organise
            </a>
            <a href={LOGIN} className="wv-btn wv-btn-line">
              Connexion
            </a>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-split" aria-label="Proposition">
        <Block html={proposition} className="wv-media" />
        <div className="wv-stack" style={{ gap: 28 }}>
          <h2 className="wv-h3">La vie est une fête. On s’occupe du reste.</h2>
          <div className="wv-stats">
            <div className="wv-stat">
              <b>&gt; 15 000</b>
              <span>Prestataires de confiance.</span>
            </div>
            <div className="wv-stat">
              <b>25 %</b>
              <span>Économie de temps moyenne par événement.</span>
            </div>
          </div>
          <div className="wv-btns">
            <a href={links.about} className="wv-btn wv-btn-dark">
              À propos
            </a>
            <a href={LOGIN} className="wv-btn wv-btn-line">
              Connexion
            </a>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-lime wv-center" aria-label="Fonctionnalités">
        <h2 className="wv-h2" style={{ maxWidth: 900 }}>
          Gagnez du temps sur tous vos événements.
        </h2>
        <Block html={carrousel} className="wv-car" />
      </section>

      <section className="wv-sec wv-split" aria-label="Modèle">
        <img src="/vitrine/gratuit.jpg" alt="" className="wv-photo" />
        <div className="wv-stack" style={{ gap: 24 }}>
          <h2 className="wv-h2">Tu ne paies rien (oui).</h2>
          <p className="wv-p">Merry est 100 % gratuite pour les organisateurs (pas 99 %). Tes demandes de devis (budget, lieu, questions…) arrivent chez les prestataires. Ils utilisent des crédits pour y répondre.</p>
          <div className="wv-btns">
            <a href={SIGNUP} className="wv-btn wv-btn-dark">
              J'organise
            </a>
            <a href={links.pro} className="wv-btn wv-btn-line">
              Modèle
            </a>
          </div>
        </div>
      </section>

      <section className="wv-sec wv-faq" aria-labelledby="wv-faq">
        <div>
          <h2 id="wv-faq" className="wv-h2">
            FAQ.
          </h2>
          <div className="wv-acc">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
        <img src="/vitrine/faq.jpg" alt="" className="wv-photo" style={{ minHeight: 640 }} />
      </section>

      <section className="wv-guest" aria-label="Invités">
        <div className="wv-marquee" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>Invité ?</span>
          ))}
        </div>
        <p>Lucky you ! Tu as juste à entrer les prénoms de ceux qui organisent et la date, ou le code de ton invitation, et tu retrouves la page de la fête, la cagnotte ou la liste de cadeaux, avec toutes les infos pratiques.</p>
        <a href={links.guests} className="wv-btn wv-btn-lime">
          Je suis invité !
        </a>
      </section>
    </Frame>
  );
}
