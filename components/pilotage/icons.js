// Icônes du pilotage : le style « pleines citron » du design system (tokens.json, `icons`), trait encre et remplissage
// citron sur la forme. Les quatre dernières ne sont pas encore dans la bibliothèque, dessinées dans le même style.

const CITRON = "#fff700";
const TINT = "#fffdb8";
const INK = "#1c1c1a";

const ICONS = {
  invites: `<path d="M16 14.6c2.6.2 4.6 2 5.3 5.4H13c0-2.3.9-4.3 3-5.4z" fill="${TINT}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="17" cy="9" r="2.5" fill="${TINT}" stroke="${INK}" stroke-width="1.3"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="8" r="3.5" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/>`,
  budget: `<rect x="3" y="6" width="18" height="13" rx="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/><path d="M3 10h18" stroke="${INK}" stroke-width="1.5"/><path d="M16.5 14.5h1.5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  date: `<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`,
  lieu: `<path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="#ffffff" stroke="${INK}" stroke-width="1.3"/>`,
  securite: `<path d="M12 3.5 5 6.5v5.2c0 4.6 3 8.3 7 9.3 4-1 7-4.7 7-9.3V6.5z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="m9.3 12.3 2 2 3.6-4" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  messagerie: `<path d="M4 5h16v11H8.5L4 20z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8.5" cy="10.5" r="1" fill="${INK}"/><circle cx="12" cy="10.5" r="1" fill="${INK}"/><circle cx="15.5" cy="10.5" r="1" fill="${INK}"/>`,
  document: `<path d="M6 3h8l5 5v13H6z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3v5h5" fill="${TINT}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 12h6M9 15h6" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`,
  reglages: `<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="6" r="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/><circle cx="8" cy="12" r="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/><circle cx="18" cy="18" r="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/>`,
  rechercher: `<circle cx="10" cy="10" r="6" fill="${CITRON}" stroke="${INK}" stroke-width="1.6"/><path d="M21 21l-4.3-4.3" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  filtrer: `<path d="M4 5h16M7 12h10M10 19h4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="5" r="2.1" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/><circle cx="10" cy="12" r="2.1" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/><circle cx="13" cy="19" r="2.1" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/>`,
  ajouter: `<circle cx="12" cy="12" r="9" fill="${CITRON}" stroke="${INK}" stroke-width="1.6"/><path d="M12 8v8M8 12h8" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  avis: `<path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" fill="${CITRON}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
  photo: `<rect x="3" y="7" width="18" height="13" rx="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/><path d="M8 7l1.5-2h5L16 7" fill="${TINT}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="12" cy="13.5" r="3.5" fill="#ffffff" stroke="${INK}" stroke-width="1.5"/><circle cx="12" cy="13.5" r="1.1" fill="${INK}"/>`,
  telephone: `<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  email: `<rect x="3" y="5" width="18" height="14" rx="2" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/><path d="M4 7l8 6 8-6" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  accueil: `<path d="M3.5 11 12 4l8.5 7v9.5h-6v-6h-5v6h-6z" fill="${CITRON}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  croissance: `<rect x="4" y="13" width="4.5" height="7.5" rx="1" fill="${TINT}" stroke="${INK}" stroke-width="1.4"/><rect x="9.8" y="9" width="4.5" height="11.5" rx="1" fill="${CITRON}" stroke="${INK}" stroke-width="1.4"/><rect x="15.6" y="4" width="4.5" height="16.5" rx="1" fill="${CITRON}" stroke="${INK}" stroke-width="1.4"/>`,
  horloge: `<circle cx="12" cy="12" r="8.5" fill="${CITRON}" stroke="${INK}" stroke-width="1.5"/><path d="M12 7.5V12l3 2" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  actualiser: `<circle cx="12" cy="12" r="4" fill="${CITRON}" stroke="${INK}" stroke-width="1.3"/><path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M20 4v7h-7" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
};

export function PilotIcon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.document }} />;
}
