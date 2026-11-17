// Durée de validité des liens signés vers les photos du catalogue (stockage privé `catalog-photos`), dans l'appli.
// Elle était d'une heure : un lien expiré répond 400 et la photo s'affiche cassée. Vu le 17 novembre 2026 dans les
// journaux Supabase : chez les couples qui rouvrent l'appli sur leur téléphone plus d'une heure après (iPhone, le 15 et
// le 16 novembre), et dans PostHog, qui rejoue les sessions des heures ou des jours plus tard avec les liens d'origine.
// Son lecteur automatique de replays (« Bugs visibles ») y voyait des photos cassées et signalait un bug qui n'existait
// pas. Trente jours : la durée pendant laquelle PostHog garde un replay. Les photos du catalogue sont déjà publiques
// sur le site vitrine (lib/seo/data.js, liens de huit jours renouvelés par le cache de la page).
export const PHOTO_URL_SECONDS = 30 * 86400;
