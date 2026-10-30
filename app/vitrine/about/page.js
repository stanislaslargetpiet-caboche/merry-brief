import Frame from "@/components/vitrine/Frame";

export const metadata = {
  title: "À propos — Merry",
  description: "On ne cessera jamais de se réunir. Merry met le métier d’event planner entre les mains de chacun.",
  alternates: { canonical: "https://www.withmerry.com/about" },
};

const BLOCKS = [
  ["Organiser un événement est un métier", ["Un grand événement, c’est plusieurs prestataires, des semaines de préparation, des budgets à plusieurs €€€. Merry permet à chacun de devenir « event planner » (on avait pas mieux)."]],
  [
    "Merry existe parce que l’IA rebat les cartes.",
    ["Organiser un événement c’est : chercher, comparer, relancer, vérifier, suivre. L’IA sait désormais faire tout cela, pour tout le monde, et de manière ultra-personnalisée. Merry met ce métier entre les mains de chacun : un seul endroit pour choisir son lieu, ses prestataires, suivre son budget et ses paiements, avec un conseiller quand il le faut."],
    "Vous gardez les choix. Nous prenons la logistique.",
  ],
  ["Un marché immense, sans plateforme.", ["En Europe, 1,8 million de mariages par an et des millions de fêtes et de célébrations. 35 Mds€ dépensés chaque année pour les seuls mariages, des centaines de Mds€ en comptant tous les événements privés. Un marché fragmenté entre des milliers de lieux et de prestataires locaux, où aucun acteur ne prend l’événement en charge de bout en bout."]],
  ["Une nouvelle catégorie : service-as-a-software (SaaS is not dead)", ["Merry n’est ni une agence, ni un annuaire. C’est une entreprise de service qui tourne comme un logiciel : gratuite pour ceux qui organisent, rémunérée par les prestataires, qui utilisent des crédits pour répondre aux demandes qu’elle leur apporte, capable de servir des millions d’événements avec la qualité d’un professionnel."]],
];

export default async function VitrineAPropos() {
  return (
    <Frame current="about">
      <main className="wv-about">
        <img src="/vitrine/apropos.jpg" alt="" className="wv-photo" />
        <div className="wv-text">
          <h1 className="wv-h2">On ne cessera jamais de se réunir.</h1>
          <p className="wv-p">Il restera toujours les moments où l’on se retrouve. Un mariage, un anniversaire, une fête de famille, un séminaire. Ce sont les dépenses que personne ne regrette. Et pourtant, organiser ces moments reste la partie que tout le monde déteste : des dizaines de prestataires, des devis qui n’arrivent pas, des relances, des tableurs, de l’argent qui circule entre cinq comptes.</p>
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
            <h2 className="wv-h4">Nous construisons la plateforme sur laquelle tout le monde organisera chaque événement de sa vie.</h2>
          </div>
        </div>
      </main>
    </Frame>
  );
}
