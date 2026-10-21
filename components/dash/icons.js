// Icônes du tableau de bord : trait simple pour l'interface, bicolores façon Alan
// (trait encre + aplat vert Merry) pour les postes, tâches et modules.

const LINE_ICONS = {
  home: '<path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 2 5.3 5.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17M8.5 15l2.2 2.2 4.3-4.4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16.5 14.5h1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',
  upload: '<path d="M12 15.5V4.5M7 9l5-5 5 5M4.5 19.5h15"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12 13.8 14 12 20.5 10.2 14 3.5 12 10.2 10z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chev: '<path d="m9.5 6 6 6-6 6"/>',
  chevDown: '<path d="m6 9.5 6 6 6-6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18M7 15h4"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3l7.5-7.5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  bubble: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16.5h-1a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
  pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 2 2"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h10"/>',
};

const DUO_ICONS = {
  users: '<circle cx="9" cy="8" r="3.5" fill="FILL"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 2 5.3 5.4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2" fill="FILL"/><path d="M8 3v4M16 3v4M3.5 10h17M8.5 15l2.2 2.2 4.3-4.4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2" fill="FILL"/><path d="M3 10h18M16.5 14.5h1.5"/>',
  traiteur: '<path d="M4.5 16a7.5 7.5 0 0 1 15 0z" fill="FILL"/><path d="M12 8.5v-2M10.5 6.5h3M3 19h18"/>',
  lieu: '<path d="M4 20V10l8-6 8 6v10z" fill="FILL"/><path d="M10 20v-5h4v5"/>',
  photo: '<rect x="3" y="7" width="18" height="13" rx="2.5" fill="FILL"/><circle cx="12" cy="13.5" r="3.5" fill="#ffffff"/><path d="M8.5 7 10 4.5h4L15.5 7"/>',
  musique: '<path d="M9 18V6l11-2.5v12"/><circle cx="6" cy="18" r="3" fill="FILL"/><circle cx="17" cy="15.5" r="3" fill="FILL"/>',
  fleurs: '<circle cx="12" cy="6.5" r="3" fill="FILL"/><circle cx="8" cy="10" r="3" fill="FILL"/><circle cx="16" cy="10" r="3" fill="FILL"/><path d="M12 12v9M12 17.5c-1.8-1.8-3.8-2-5.3-1.4M12 19c1.7-1.5 3.5-1.7 5-1.1"/>',
  tenues: '<path d="M9.5 3h5l-.8 4.5L18 21H6l4.3-13.5z" fill="FILL"/><path d="M10.3 7.5h3.4"/>',
  alliances: '<circle cx="9" cy="14.5" r="5" fill="FILL"/><circle cx="15" cy="14.5" r="5"/><path d="m10 4.5 2-1.5 2 1.5-2 3z"/>',
  enveloppe: '<rect x="3" y="5.5" width="18" height="13" rx="2" fill="FILL"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  beaute: '<path d="M12 3.5 13.8 10 20.5 12 13.8 14 12 20.5 10.2 14 3.5 12 10.2 10z" fill="FILL"/>',
  imprevus: '<path d="M3 12a9 9 0 0 1 18 0z" fill="FILL"/><path d="M12 12v6.5a2 2 0 0 0 4 0"/>',
  mairie: '<path d="M6 3h8.5L19 7.5V21H6z" fill="FILL"/><path d="M14.5 3v4.5H19M9 12h6M9 15.5h6"/>',
  table: '<circle cx="12" cy="12" r="4.5" fill="FILL"/><circle cx="12" cy="3.8" r="1.6"/><circle cx="12" cy="20.2" r="1.6"/><circle cx="3.8" cy="12" r="1.6"/><circle cx="20.2" cy="12" r="1.6"/>',
  horloge: '<circle cx="12" cy="12" r="8.5" fill="FILL"/><path d="M12 7.5V12l3 2"/>',
  lit: '<path d="M3 19V7M3 14h18v5"/><path d="M10 14v-3.5h8a3 3 0 0 1 3 3v.5z" fill="FILL"/><circle cx="6.5" cy="11.5" r="1.8" fill="FILL"/>',
  adresse: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" fill="FILL"/><circle cx="12" cy="9.5" r="2.5" fill="#ffffff"/>',
  boutique: '<path d="M4 9h16l-1.5-5h-13z" fill="FILL"/><path d="M5 9v11h14V9M10 20v-5h4v5"/>',
  ecran: '<rect x="3" y="4.5" width="18" height="12" rx="2" fill="FILL"/><path d="M9 20h6M12 16.5V20"/>',
  cadeau: '<rect x="3.5" y="8" width="17" height="4" rx="1" fill="FILL"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8C10.5 5 7 4.5 7 6.8 7 8 9 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8 15 8 12 8z"/>',
  cloche: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" fill="FILL"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  upload: '<path d="M5 15v4.5h14V15" fill="none"/><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9"/>',
  autre: '<rect x="4" y="4" width="16" height="16" rx="4" fill="FILL"/><path d="M8.5 12h7M12 8.5v7"/>',
};

export const DUO_KEYS = Object.keys(DUO_ICONS);

export function Icon({ name, size = 18, stroke = "currentColor", sw = 1.8, className, style }) {
  const inner = Object.hasOwn(LINE_ICONS, name) ? LINE_ICONS[name] : LINE_ICONS.plus;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function DuoIcon({ name, size = 20, fill = "var(--d-lime)", stroke = "#1c1c1a", sw = 1.6 }) {
  const inner = (Object.hasOwn(DUO_ICONS, name) ? DUO_ICONS[name] : DUO_ICONS.autre).replaceAll("FILL", fill);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function Tile({ name, size = 36, bg = "#f4f3ef", fill }) {
  return (
    <span className="d-tile" style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: bg }}>
      <DuoIcon name={name} size={Math.round(size * 0.56)} fill={fill} />
    </span>
  );
}

// Devine l'icône d'une tâche ou d'un poste à partir de son libellé
const GUESS = [
  [/traiteur|repas|menu|brunch|cocktail|d[îi]ner|g[âa]teau|vin/i, "traiteur"],
  [/lieu|salle|domaine|ch[âa]teau/i, "lieu"],
  [/photo|vid[ée]o|film/i, "photo"],
  [/dj|musique|groupe|orchestre|playlist|son/i, "musique"],
  [/fleur|d[ée]co|fleuriste/i, "fleurs"],
  [/robe|costume|tenue|essayage|chaussure/i, "tenues"],
  [/alliance|bague/i, "alliances"],
  [/faire-part|save-the-date|papeterie|enveloppe|carton|menu imprim/i, "enveloppe"],
  [/coiff|maquill|beaut/i, "beaute"],
  [/impr[ée]vu|divers/i, "imprevus"],
  [/mairie|dossier|civil|papier|administratif/i, "mairie"],
  [/plan de table|table/i, "table"],
  [/d[ée]roul[ée]|horaire|planning/i, "horloge"],
  [/chambre|h[ôo]tel|h[ée]bergement|g[îi]te|nuit/i, "lit"],
  [/adresse/i, "adresse"],
  [/invit|relance|liste/i, "users"],
  [/budget|payer|paiement|acompte|solde/i, "wallet"],
  [/cadeau|liste de mariage|cagnotte/i, "cadeau"],
  [/site/i, "ecran"],
];

export function guessIcon(label) {
  for (const [re, key] of GUESS) if (re.test(label || "")) return key;
  return "autre";
}
