import Legal from "@/components/vitrine/Legal";

export const metadata = {
  title: "Politique de confidentialité | Merry",
  description: "Quelles données Merry traite, pourquoi, combien de temps, avec quels prestataires, et quels sont vos droits.",
  alternates: { canonical: "https://www.withmerry.com/confidentialite" },
};

const SECTIONS = [
  [
    "Qui est responsable",
    [
      "Merry (withmerry.com et app.withmerry.com) est un service édité par Stanislas Larget-Piet, responsable du traitement des données décrites ici. Pour toute question sur vos données : bonjour@withmerry.com. Les coordonnées postales de l'éditeur sont communiquées sur demande à cette adresse.",
    ],
  ],
  [
    "Les données traitées, et pourquoi",
    [
      "Compte d'organisateur : adresse mail, prénom, mot de passe (jamais lisible par Merry), et les réponses au questionnaire de départ (date, lieu, nombre d'invités, budget). Base légale : l'exécution du service que vous demandez.",
      "Organisation du mariage : la liste des invités que vous saisissez ou importez (noms, et selon ce que vous renseignez, adresses, mails, téléphones, régimes alimentaires, réponses), les prestataires, le budget et les paiements, les documents déposés, le site de mariage et le formulaire que vous publiez. Vous êtes responsable des données de vos invités que vous confiez à Merry ; Merry les traite pour votre compte, uniquement pour faire fonctionner votre espace.",
      "Invités qui répondent au formulaire ou visitent le site de mariage : les réponses que vous envoyez sont transmises aux organisateurs du mariage ; une visite du site est comptée de façon anonyme (jeton aléatoire gardé dans votre navigateur, sans adresse IP conservée).",
      "Prestataires (espace /pro) : adresse mail et téléphone de l'établissement, fiche, tarifs, disponibilités, échanges avec les couples. Base légale : l'exécution du service, et l'intérêt légitime de Merry à présenter des établissements aux couples pour les fiches issues de sources publiques.",
      "Mesure d'audience : avec votre accord (bandeau cookies), PostHog enregistre les pages vues, les clics et le parcours, hébergés dans l'Union européenne. Ce que vous tapez dans les champs n'est jamais enregistré. Sans accord, rien n'est envoyé.",
    ],
  ],
  [
    "Les prestataires qui nous aident",
    [
      "Vos données sont hébergées et traitées par des sous-traitants qui n'y accèdent que pour nous fournir leur service :",
      [
        "Supabase (base de données, comptes, fichiers), région Union européenne.",
        "Vercel (hébergement de l'application).",
        "PostHog (mesure d'audience, Union européenne), seulement après votre accord.",
        "Resend (envoi des mails : invitations d'organisateurs, notifications aux prestataires et aux couples).",
        "Anthropic (lecture par l'IA des listes d'invités, devis et factures que vous choisissez de faire lire ; les documents sont transmis le temps de la lecture, sans servir à entraîner un modèle).",
        "Google (recherche d'établissements et de villes via Google Places quand vous ajoutez un prestataire).",
        "Weglot (traduction du site vitrine en anglais : le texte des pages publiques lui est transmis pour être traduit).",
      ],
      "Aucune donnée n'est vendue ni cédée à des fins publicitaires.",
    ],
  ],
  [
    "Combien de temps",
    [
      "Les données de votre espace sont conservées tant que votre compte existe. Vous pouvez supprimer votre compte depuis les réglages : vos préférences partent avec lui ; les données du mariage restent accessibles aux autres organisateurs s'il y en a, et sont supprimées avec le mariage sinon. Les mesures d'audience sont conservées douze mois au plus. Les journaux techniques, trente jours.",
    ],
  ],
  [
    "Vos droits",
    [
      "Vous pouvez accéder à vos données, les corriger, les faire effacer, en demander la portabilité, limiter ou vous opposer à leur traitement, et retirer votre accord à la mesure d'audience à tout moment (le bandeau se rouvre en effaçant les données du site dans votre navigateur). Écrivez à bonjour@withmerry.com : nous répondons sous un mois. Vous pouvez aussi saisir la CNIL (cnil.fr).",
      "Un invité qui souhaite que ses données soient retirées d'une liste peut s'adresser aux organisateurs du mariage, ou à nous : nous les relayons.",
    ],
  ],
  [
    "Cookies et stockage local",
    [
      "Merry utilise le stockage de votre navigateur pour vous garder connecté, retenir vos préférences (langue, colonnes affichées, brouillons) et, pour les invités, retenir que vous avez répondu. Ces éléments sont nécessaires au service et ne servent pas à vous suivre. Les cookies de mesure d'audience (PostHog) ne sont posés qu'après votre accord. Le site vitrine retient la langue choisie (Weglot).",
    ],
  ],
  [
    "Sécurité",
    [
      "Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés de façon irréversible, chaque organisateur n'accède qu'à ses mariages, et les fichiers déposés ne sont lisibles qu'avec un lien signé temporaire. En cas d'incident touchant vos données, nous vous prévenons, ainsi que la CNIL quand la loi l'exige.",
    ],
  ],
];

export default function Confidentialite() {
  return <Legal title="Politique de confidentialité" updated="2 novembre 2026" intro="En clair : ce que Merry sait de vous, pourquoi, avec qui, et comment reprendre la main." sections={SECTIONS} />;
}
