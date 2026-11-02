import Legal from "@/components/vitrine/Legal";

export const metadata = {
  title: "Conditions d'utilisation | Merry",
  description: "Les règles d'utilisation de Merry pour les organisateurs, les invités et les prestataires.",
  alternates: { canonical: "https://www.withmerry.com/cgu" },
};

// Les éléments entre crochets sont à compléter par l'éditeur (raison sociale, adresse, contact) : voir le README.
const SECTIONS = [
  [
    "Le service",
    [
      "Merry est un outil en ligne pour organiser un mariage : invités, budget, rétroplanning, prestataires, site de mariage et formulaire pour les invités. Il est édité par [raison sociale et forme juridique], [adresse du siège], [adresse de contact]. En créant un compte ou en utilisant le service, vous acceptez ces conditions.",
      "Merry est gratuit pour les organisateurs. Les prestataires disposent d'un espace dédié, dont certaines fonctions se paient en crédits selon les tarifs affichés dans cet espace.",
    ],
  ],
  [
    "Votre compte",
    [
      "Vous êtes responsable de la confidentialité de vos identifiants et de ce qui est fait depuis votre compte. Un mariage peut être organisé à plusieurs : chaque organisateur invité accède à l'ensemble de l'espace du mariage. Invitez des personnes de confiance.",
      "Vous pouvez supprimer votre compte à tout moment depuis les réglages.",
    ],
  ],
  [
    "Vos contenus et les données de vos invités",
    [
      "Ce que vous mettez dans Merry (listes, documents, textes et photos du site de mariage) reste à vous. Vous nous accordez seulement le droit de l'héberger et de l'afficher pour faire fonctionner le service.",
      "Vous vous engagez à n'y mettre que des données que vous avez le droit de traiter : en confiant à Merry la liste de vos invités, vous le faites en tant que responsable de ces données, et Merry les traite pour votre compte (voir la politique de confidentialité). Pas de contenus illicites, trompeurs ou portant atteinte à des tiers.",
      "Le site de mariage et le formulaire sont publics pour qui connaît leur lien : ne les partagez qu'aux personnes concernées.",
    ],
  ],
  [
    "Prestataires",
    [
      "Les fiches du catalogue viennent de sources publiques et des prestataires eux-mêmes. Un prestataire revendique sa fiche en prouvant qu'il dispose de l'adresse mail de l'établissement, puis en répond : exactitude des informations, tarifs, disponibilités, réponses aux couples.",
      "Merry met en relation : il n'est partie à aucun contrat entre un couple et un prestataire, et ne garantit ni la disponibilité, ni la qualité, ni les prix d'un prestataire. Les crédits achetés ne sont pas remboursables, sauf disposition légale contraire.",
    ],
  ],
  [
    "Usage raisonnable",
    [
      "Il est interdit d'utiliser Merry pour envoyer des messages non sollicités, pour extraire le catalogue ou les données d'autres utilisateurs, pour contourner les limites techniques du service ou pour nuire à son fonctionnement. Merry peut suspendre un compte en cas d'abus, après vous avoir prévenu quand c'est possible.",
    ],
  ],
  [
    "Ce que Merry garantit, et ce qu'il ne garantit pas",
    [
      "Nous faisons de notre mieux pour que le service soit disponible et vos données sauvegardées, sans pouvoir garantir une absence totale d'interruption ou d'erreur. Les lectures par l'IA (listes, devis) sont une aide : vérifiez toujours ce qui est enregistré. Dans les limites de la loi, la responsabilité de Merry est limitée aux dommages directs et prévisibles.",
    ],
  ],
  [
    "Évolutions et droit applicable",
    [
      "Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de la page et les changements importants vous sont annoncés dans l'application. Elles sont soumises au droit français. En cas de litige, et après avoir cherché une solution amiable avec nous, les tribunaux compétents sont ceux du siège de l'éditeur, sans préjudice des règles protectrices applicables aux consommateurs.",
    ],
  ],
];

export default function ConditionsUtilisation() {
  return <Legal title="Conditions d'utilisation" updated="2 novembre 2026" intro="Les règles du jeu, écrites pour être lues." sections={SECTIONS} />;
}
