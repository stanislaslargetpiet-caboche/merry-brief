/*
 * Textes de l'onboarding V2 (components/Brief.js), en français et en anglais.
 * Source du français : canvas « Merry · Carte brief », page « Onboarding &
 * connexion v2 », validé le 27 oct. 2026. L'anglais est une première
 * traduction, à relire avant que la landing anglaise ne pointe vers l'appli.
 *
 * Les valeurs (value) sont stables et en français : ce sont elles qui partent
 * dans la base, quelle que soit la langue affichée.
 */

// Ambiances : la valeur enregistrée est le libellé français (lu par le tableau de bord et le site de mariage).
const VIBES = [
  ["Champêtre", "Rustic"],
  ["Chic", "Chic"],
  ["Intime", "Intimate"],
  ["Grande fête", "Big party"],
  ["Bohème", "Bohemian"],
  ["Élégant", "Elegant"],
  ["Romantique", "Romantic"],
  ["Moderne", "Modern"],
  ["Sobre", "Understated"],
  ["Festif", "Festive"],
  ["Bord de mer", "Seaside"],
  ["Vintage", "Vintage"],
  ["Nature", "Nature"],
  ["Minimaliste", "Minimalist"],
  ["Un peu dingue", "A bit wild"],
  ["On ne sait pas", "We don't know yet"],
];
export const VIBE_UNSURE = "On ne sait pas";

const vibes = (i) => VIBES.map((v) => ({ value: v[0], label: v[i] }));

export const BRIEF_TEXT = {
  fr: {
    logoAria: "Merry, retour au site",
    quit: "Quitter",
    quitTitle: "Retour au site (tes réponses sont gardées)",
    backAria: "Question précédente",
    next: "Suivant",
    submitting: "Création…",
    submitDone: "Accéder au dashboard",
    progressAria: (n, t) => `Étape ${n} sur ${t}`,
    unsure: "On hésite",

    steps: {
      0: { tag: "C'est parti" },
      1: { tag: "L'équipe", teamQuestion: "Qui participe à l'organisation ?", stageQuestion: "Vous en êtes où ?" },
      2: {
        tag: "L'essentiel",
        where: "Où",
        wherePlaceholder: "Provence, Golfe du Morbihan, Paris…",
        whereNoResult: "Aucun lieu trouvé. Essaie la ville ou la région la plus proche.",
        when: "Quand",
        precise: "Date précise",
        flexible: "Flexible",
        monthsHelp: "Choisissez un ou plusieurs mois.",
        guests: "Invités",
        guestsRange: (a, b) => `${a} à ${b}`,
        guestsMinAria: "Minimum d'invités",
        guestsMaxAria: "Maximum d'invités",
        budget: "Budget",
        budgetMinAria: "Budget minimum",
        budgetMaxAria: "Budget maximum",
        budgetUnsure: "Aucune idée ? On vous aide.",
        budgetKnown: "Finalement, j'ai une idée",
        budgetTbd: "À définir",
        vibes: "Votre mariage en trois mots",
      },
      3: {
        tag: "Dernière étape",
        title: "Ton tableau de bord est prêt.",
        firstNameLabel: "Ton prénom",
        partnerFirstNameLabel: "Le prénom de ta moitié",
        emailLabel: "Ton email",
        passwordLabel: "Mot de passe",
        passwordPlaceholder: "8 caractères minimum",
        footnoteLead: "En créant ton compte, tu acceptes nos",
        footnoteTos: "conditions d'utilisation",
        footnoteAnd: "et notre",
        footnotePrivacy: "politique de confidentialité",
        footnoteTail: ". Pas de newsletter, pas de spam.",
        loginLink: "Déjà un compte ?",
      },
    },

    preparing: {
      lines: ["On rassemble vos réponses…", "On les croise avec nos prestataires…", "On prépare une première sélection…"],
      results: ["Premiers lieux à comparer", "Budget réparti par poste", "Rétroplanning lancé"],
    },

    wedding: "Mariage",
    soon: "Bientôt",
    soonEvents: ["EVJF", "Anniversaire", "Week-end entre amis", "Séminaire d'entreprise", "Bar / Bat Mitzvah"],

    teams: [
      { value: "nous_deux", label: "Juste nous deux" },
      { value: "nous_parents", label: "Nous et nos parents" },
      { value: "nous_planner", label: "Nous et un wedding planner" },
      { value: "planner_seul", label: "Juste un wedding planner" },
    ],
    stages: [
      { value: "debut", label: "Au tout début" },
      { value: "regarde", label: "On commence à s'y pencher" },
      { value: "lieu_recherche", label: "On cherche le lieu" },
      { value: "lieu_reserve", label: "Le lieu est réservé" },
      { value: "details", label: "Presque fini" },
    ],
    vibes: vibes(0),
    monthShort: ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."],
    euros: (n) => `${n.toLocaleString("fr-FR").replace(/ /g, " ")} €`,

    errors: {
      alreadyRegistered: "Il y a déjà un compte avec cet email. Connecte-toi, ou utilise une autre adresse.",
      generic: "Ça n'est pas passé de notre côté. Réessaie, ou écris-nous à bonjour@withmerry.com.",
    },

    done: {
      welcome: (names) => `Bienvenue${names ? `, ${names}` : ""}.`,
      confirmMsg: (email) =>
        `Un mail vient de partir à ${email} : clique sur le lien pour confirmer ton compte, et ton tableau de bord s'ouvre avec tout ce que tu viens de nous dire.`,
      doneMsg: "Votre tableau de bord est ouvert : le brief, le budget, la liste d'invités et les premiers lieux à comparer vous attendent.",
      dashboardBtn: "Accéder au dashboard",
      backToSite: "Retour au site",
    },
  },

  en: {
    logoAria: "Merry, back to the site",
    quit: "Quit",
    quitTitle: "Back to the site (your answers are saved)",
    backAria: "Previous question",
    next: "Next",
    submitting: "Creating…",
    submitDone: "Go to dashboard",
    progressAria: (n, t) => `Step ${n} of ${t}`,
    unsure: "Not sure yet",

    steps: {
      0: { tag: "Let's go" },
      1: { tag: "The team", teamQuestion: "Who's involved in planning?", stageQuestion: "Where are you at?" },
      2: {
        tag: "The essentials",
        where: "Where",
        wherePlaceholder: "Provence, Gulf of Morbihan, Paris…",
        whereNoResult: "No place found. Try the nearest town or region.",
        when: "When",
        precise: "Exact date",
        flexible: "Flexible",
        monthsHelp: "Pick one or several months.",
        guests: "Guests",
        guestsRange: (a, b) => `${a} to ${b}`,
        guestsMinAria: "Minimum guests",
        guestsMaxAria: "Maximum guests",
        budget: "Budget",
        budgetMinAria: "Minimum budget",
        budgetMaxAria: "Maximum budget",
        budgetUnsure: "No idea? We'll help.",
        budgetKnown: "Actually, I have an idea",
        budgetTbd: "To be set",
        vibes: "Your wedding in three words",
      },
      3: {
        tag: "Last step",
        title: "Your dashboard is ready.",
        firstNameLabel: "Your first name",
        partnerFirstNameLabel: "Your partner's first name",
        emailLabel: "Your email",
        passwordLabel: "Password",
        passwordPlaceholder: "8 characters minimum",
        footnoteLead: "By creating your account, you agree to our",
        footnoteTos: "terms of use",
        footnoteAnd: "and our",
        footnotePrivacy: "privacy policy",
        footnoteTail: ". No newsletter, no spam.",
        loginLink: "Already have an account?",
      },
    },

    preparing: {
      lines: ["Gathering your answers…", "Matching them with our vendors…", "Putting together a first shortlist…"],
      results: ["First venues to compare", "Budget split by item", "Timeline started"],
    },

    wedding: "Wedding",
    soon: "Soon",
    soonEvents: ["Bachelorette party", "Birthday", "Weekend with friends", "Company retreat", "Bar / Bat Mitzvah"],

    teams: [
      { value: "nous_deux", label: "Just the two of us" },
      { value: "nous_parents", label: "Us and our parents" },
      { value: "nous_planner", label: "Us and a wedding planner" },
      { value: "planner_seul", label: "Just a wedding planner" },
    ],
    stages: [
      { value: "debut", label: "At the very beginning" },
      { value: "regarde", label: "Starting to look into it" },
      { value: "lieu_recherche", label: "Looking for the venue" },
      { value: "lieu_reserve", label: "The venue is booked" },
      { value: "details", label: "Almost done" },
    ],
    vibes: vibes(1),
    monthShort: ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."],
    euros: (n) => `€${n.toLocaleString("en-GB")}`,

    errors: {
      alreadyRegistered: "There's already an account with this email. Log in, or use a different address.",
      generic: "Something went wrong on our end. Try again, or write to us at bonjour@withmerry.com.",
    },

    done: {
      welcome: (names) => `Welcome${names ? `, ${names}` : ""}.`,
      confirmMsg: (email) =>
        `We just sent an email to ${email}: click the link to confirm your account, and your dashboard opens with everything you just told us.`,
      doneMsg: "Your dashboard is open: the brief, the budget, the guest list and the first venues to compare are waiting for you.",
      dashboardBtn: "Go to dashboard",
      backToSite: "Back to the site",
    },
  },
};
