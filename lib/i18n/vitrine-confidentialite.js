/*
 * Politique de confidentialité du site vitrine (app/vitrine/confidentialite/page.js), en français et en anglais.
 *
 * Weglot retiré du sous-traitant et de la section Cookies le 4 nov. 2026 (remplacé par des
 * traductions en dur dans le code, langue retenue en cookie + stockage local côté appli,
 * voir lib/lang.js) : ne pas réintroduire Weglot ici tant qu'il n'est pas de retour dans le code.
 */

export const CONFIDENTIALITE_TEXT = {
  fr: {
    title: "Politique de confidentialité",
    updated: "6 novembre 2026",
    intro: "En clair : ce que Merry sait de vous, pourquoi, avec qui, et comment reprendre la main.",
  },
  en: {
    title: "Privacy policy",
    updated: "November 6, 2026",
    intro: "In plain terms: what Merry knows about you, why, with whom, and how to take back control.",
  },
};

export const CONFIDENTIALITE_SECTIONS = {
  fr: [
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
        "Établissements référencés sans compte : nom, adresse, mail et téléphone professionnels, collectés depuis des sources publiques (site de l'établissement, Google, registres et annuaires professionnels). Merry s'en sert pour présenter l'établissement aux couples, le prévenir d'une demande, vérifier une demande d'accès à sa fiche et lui présenter le service par mail. Base légale : l'intérêt légitime de Merry. Chaque mail comporte un lien de désinscription, et l'établissement peut faire corriger ou retirer sa fiche en écrivant à bonjour@withmerry.com.",
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
          "Anthropic (lecture par l'IA des listes d'invités, devis et factures que vous choisissez de faire lire, et, pour les prestataires, proposition de réponse à une demande : les prénoms, les dates, le nombre d'invités, la région et le message du couple, avec la fiche du prestataire, sont transmis le temps de la rédaction ; rien n'est transmis pour entraîner un modèle).",
          "Google (recherche d'établissements et de villes via Google Places quand vous ajoutez un prestataire).",
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
        "Merry utilise le stockage de votre navigateur pour vous garder connecté, retenir vos préférences (langue, colonnes affichées, brouillons) et, pour les invités, retenir que vous avez répondu. Ces éléments sont nécessaires au service et ne servent pas à vous suivre. Les cookies de mesure d'audience (PostHog) ne sont posés qu'après votre accord. Le site vitrine retient la langue choisie en cookie et en stockage local, sans tiers.",
      ],
    ],
    [
      "Sécurité",
      [
        "Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés de façon irréversible, chaque organisateur n'accède qu'à ses mariages, et les fichiers déposés ne sont lisibles qu'avec un lien signé temporaire. En cas d'incident touchant vos données, nous vous prévenons, ainsi que la CNIL quand la loi l'exige.",
      ],
    ],
  ],
  en: [
    [
      "Who's responsible",
      [
        "Merry (withmerry.com and app.withmerry.com) is a service published by Stanislas Larget-Piet, who is the controller for the data described here. For any question about your data: bonjour@withmerry.com. The publisher's postal address is available on request at that address.",
      ],
    ],
    [
      "The data we process, and why",
      [
        "Organizer account: email address, first name, password (never readable by Merry), and your answers to the starting questionnaire (date, venue, guest count, budget). Legal basis: performing the service you asked for.",
        "Wedding organization: the guest list you enter or import (names, and depending on what you fill in, addresses, emails, phone numbers, dietary needs, RSVPs), vendors, budget and payments, documents you upload, the wedding website and the form you publish. You're responsible for your guests' data that you hand to Merry; Merry processes it on your behalf, only to run your space.",
        "Guests who answer the form or visit the wedding website: the answers you send are passed on to the wedding's organizers; a site visit is counted anonymously (a random token kept in your browser, no IP address kept).",
        "Vendors (the /pro space): the venue or business's email and phone number, listing, pricing, availability, exchanges with couples. Legal basis: performing the service, and Merry's legitimate interest in showing couples listings built from public sources.",
        "Businesses listed without an account: business name, address, email and phone number, collected from public sources (the business's website, Google, public registers and professional directories). Merry uses them to show the business to couples, notify it of a request, verify a request for access to its listing and introduce the service by email. Legal basis: Merry's legitimate interest. Every email includes an unsubscribe link, and the business can have its listing corrected or removed by writing to bonjour@withmerry.com.",
        "Audience measurement: with your consent (cookie banner), PostHog records pages viewed, clicks and journeys, hosted in the European Union. What you type into fields is never recorded. Without your consent, nothing is sent.",
      ],
    ],
    [
      "The providers who help us",
      [
        "Your data is hosted and processed by subprocessors who only access it to provide us their service:",
        [
          "Supabase (database, accounts, files), European Union region.",
          "Vercel (application hosting).",
          "PostHog (audience measurement, European Union), only after your consent.",
          "Resend (sending emails: organizer invitations, notifications to vendors and couples).",
          "Anthropic (AI reading of guest lists, quotes and invoices you choose to have read and, for vendors, a suggested reply to an enquiry: the couple's first names, dates, guest count, region and message, together with the vendor's listing, are sent only for the time it takes to write the reply; nothing is sent to train a model).",
          "Google (finding businesses and towns via Google Places when you add a vendor).",
        ],
        "No data is sold or shared for advertising purposes.",
      ],
    ],
    [
      "How long",
      [
        "Your space's data is kept for as long as your account exists. You can delete your account from settings at any time: your preferences go with it; the wedding's data stays accessible to the other organizers if there are any, and is deleted with the wedding otherwise. Audience measurements are kept for twelve months at most. Technical logs, thirty days.",
      ],
    ],
    [
      "Your rights",
      [
        "You can access your data, correct it, have it erased, ask for portability, limit or object to its processing, and withdraw your consent to audience measurement at any time (the banner reopens if you clear this site's data in your browser). Write to bonjour@withmerry.com: we reply within a month. You can also contact the CNIL (cnil.fr).",
        "A guest who wants their data removed from a list can reach out to the wedding's organizers, or to us: we'll pass it on.",
      ],
    ],
    [
      "Cookies and local storage",
      [
        "Merry uses your browser's storage to keep you signed in, remember your preferences (language, which columns you show, drafts) and, for guests, remember that you've RSVPed. These are necessary to the service and aren't used to track you. Audience-measurement cookies (PostHog) are only set after your consent. The showcase site remembers your chosen language in a cookie and in local storage, with no third party involved.",
      ],
    ],
    [
      "Security",
      [
        "Exchanges are encrypted (HTTPS), passwords are stored irreversibly, each organizer only accesses their own weddings, and uploaded files can only be read through a temporary signed link. If an incident affects your data, we'll notify you, and the CNIL when the law requires it.",
      ],
    ],
  ],
};
