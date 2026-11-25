// Sexe estimé d'après le prénom, pour la page Acquisition › Persona (D-398) : l'inscription ne demande ni le sexe
// ni l'âge. Prénoms courants en France chez les personnes nées entre 1980 et 2005 ; un prénom porté par les deux
// sexes (Camille, Charlie…) ou absent de la liste reste « Inconnu ». C'est une estimation, affichée comme telle.
import { norm } from "@/lib/pilotage/lieux";

const FEMMES = `
adele agathe agnes alexandra alexia alice aline alix amandine amelie anais anastasia angelique anna anne annabelle
anne-laure anne-sophie apolline ariane audrey aude aurelie aurore axelle barbara beatrice berenice blandine capucine
caroline cassandra catherine cecile celia celine chloe charlotte christelle christine clara clarisse claire clemence
clementine clotilde coline constance coralie cynthia daphne delphine diane elisa elise eloise elodie elsa emeline
emilie emma estelle eugenie eva fanny faustine flavie flora florence gabrielle garance helene heloise ines iris isabelle
jade jeanne johanna josephine julia julie juliette justine karine laetitia laura laure lauren lea leila leonie lisa
lola lou louise lucie lucile ludivine lydie madeleine maeva maelle magali manon margaux margot marie marie-amelie
marina marine marion marthe mathilde maud melanie melissa mélodie morgane myriam nadia natacha nathalie noemie oceane
ophelie pauline penelope perrine philippine priscilla rachel rebecca romane rose roxane sabrina salome sandra sara
sarah segolene severine solene sonia sophie stephanie suzanne sylvie tiphaine valentine valerie vanessa victoire
victoria virginie zoe lina yasmine sana nina eleonore hortense albane marguerite louisa jessica angela carla
`;

const HOMMES = `
adam adrien alban albert alexandre alexis antoine anthony armand arnaud arthur augustin aurelien axel baptiste
benjamin benoit bertrand bruno cedric charles christophe clement corentin cyril cyrille damien david denis didier
edouard eliott emile emmanuel enzo eric etienne fabien fabrice felix florent florian francois frederic gabriel
gael gaetan gaspard gauthier geoffroy georges gilles gregoire gregory guillaume hadrien henri hugo hugues jacques
jean jean-baptiste jean-charles jean-marc jeremie jeremy jerome joachim jonathan joseph jules julien kevin laurent
leo leon loic louis luc lucas ludovic marc marius martin mathias mathieu matthieu maxence maxime michel mickael
nathan nicolas noe octave olivier oscar pascal patrick paul philippe pierre pierre-louis quentin raphael remi
renaud richard robin romain romaric samuel sebastien simon stanislas stephane sylvain theo theophile thibault
thibaut thierry thomas timothee tom tristan valentin victor vincent william xavier yann yannick yves mehdi karim
ryan sofiane yanis malo tanguy erwan killian kylian mael marin aymeric amaury foucault ambroise come
`;

// Portés par les deux sexes : jamais devinés
const MIXTES = new Set(["camille", "dominique", "claude", "alex", "charlie", "sacha", "morgan", "andrea", "eden", "ange", "noa", "sasha"]);

const liste = (s) => new Set(s.split(/\s+/).filter(Boolean).map((p) => norm(p).replace(/ /g, "-")));
const F = liste(FEMMES);
const H = liste(HOMMES);

/** « Femme », « Homme » ou null, d'après le premier prénom (« Marie-Amélie Dupont » → Femme) */
export function sexeDuPrenom(prenom) {
  const p = norm(String(prenom || "").split(/\s+/)[0]).replace(/ /g, "-");
  if (!p || MIXTES.has(p)) return null;
  if (F.has(p)) return "Femme";
  if (H.has(p)) return "Homme";
  // Prénom composé inconnu : son premier morceau (« Marie-Charlotte » → Marie, « Jean-Eudes » → Jean)
  const premier = p.split("-")[0];
  if (premier !== p && !MIXTES.has(premier)) {
    if (F.has(premier)) return "Femme";
    if (H.has(premier)) return "Homme";
  }
  return null;
}
