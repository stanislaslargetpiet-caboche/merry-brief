import Frame from "@/components/vitrine/Frame";
import { SIGNUP } from "@/lib/vitrine/routes";

export const metadata = {
  title: "À propos | Merry",
  description: "On ne cessera jamais de se réunir. Merry met l’organisation entre tes mains, gratuitement.",
  alternates: { canonical: "https://www.withmerry.com/about" },
};

const BLOCKS = [
  [
    "Organiser, c’est un métier.",
    [
      "Une dizaine de prestataires, des devis qui n’arrivent pas, des relances, des tableurs, de l’argent qui circule entre cinq comptes. Un mariage coûte 19 293 € en moyenne (Mariages.net, rapport 2026) et se prépare pendant 15 mois. Jusqu’ici, il fallait un wedding planner ou beaucoup de soirées.",
    ],
  ],
  [
    "Merry le fait avec toi.",
    [
      "Chercher, comparer, relancer, vérifier, suivre : l’IA sait désormais le faire, pour chaque fête. Merry réunit tout au même endroit : ton lieu, tes prestataires, ton budget, tes invités.",
    ],
    "Tu gardes les choix. On s’occupe de la logistique.",
  ],
  ["Gratuit pour toi.", ["Merry ne te coûte rien. Les prestataires utilisent des crédits pour répondre à tes demandes : c’est comme ça qu’on vit."]],
];

export default async function VitrineAPropos() {
  return (
    <Frame current="about">
      <main className="wv-about">
        <img src="/vitrine/apropos.jpg" alt="" className="wv-photo" />
        <div className="wv-text">
          <h1 className="wv-h2">On ne cessera jamais de se réunir.</h1>
          <p className="wv-lead">Un mariage, un anniversaire, une fête de famille : personne ne regrette ces moments. Les organiser, en revanche, tout le monde s’en passerait.</p>
          {BLOCKS.map(([title, paragraphs, lead]) => (
            <div key={title} className="wv-block">
              <h2 className="wv-h4">{title}</h2>
              {paragraphs.map((p) => (
                <p key={p} className="wv-p">
                  {p}
                </p>
              ))}
              {lead && <p className="wv-lead">{lead}</p>}
            </div>
          ))}
          <div className="wv-block">
            <h2 className="wv-h4">On construit l’endroit où chacun organisera chaque fête de sa vie. On commence par le mariage.</h2>
            <div>
              <a href={SIGNUP} className="wv-btn wv-btn-dark">
                J'organise ma fête
              </a>
            </div>
          </div>
        </div>
      </main>
    </Frame>
  );
}
