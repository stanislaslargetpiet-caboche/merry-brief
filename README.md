# Merry · Onboarding et compte

Le parcours d'inscription des couples (4 étapes : la fête, l'équipe, l'essentiel, le compte, puis bienvenue), à héberger sur Vercel et à relier aux boutons « C'est parti ! » du site Squarespace. Il crée le compte du couple (Supabase Auth, email et mot de passe) et enregistre le brief dans la table `briefs`. Les écrans suivent le canvas « Merry · Carte brief », page « Onboarding & connexion v2 », validée le 27 octobre 2026.

## 1. Supabase (15 minutes)

1. Crée un projet sur supabase.com (région EU, Francfort ou Paris).
2. SQL Editor > New query : colle le contenu de `supabase/schema.sql`, Run, puis de `supabase/onboarding-simplifie.sql`, Run, puis de `supabase/onboarding-v2.sql`, Run (date flexible sur plusieurs mois, fourchettes min / max d'invités et de budget).
3. Authentication > Providers > Email : laisse Email activé.
   Pour le lancement, désactive « Confirm email » (Authentication > Providers > Email > Confirm email) : le couple arrive sur son tableau de bord sans passer par sa boîte mail. Si tu le laisses activé, le code gère le cas (écran « vérifie ta boîte mail », brief envoyé à la première connexion).
4. Authentication > URL Configuration : Site URL = l'URL de l'appli (ex. https://app.withmerry.com).
5. Bouton Connect > Framework > Next.js > onglet `.env.local` : copie les deux lignes (URL et clé publishable).

## 2. Lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplis les deux variables
npm run dev                  # http://localhost:3000
```

Sans `.env.local`, le parcours tourne quand même et la création de compte est simulée (visible dans la console du navigateur).

## 3. Déployer sur Vercel (10 minutes)

1. Pousse ce dossier sur un repo GitHub (privé).
2. vercel.com > Add New > Project > importe le repo. Framework détecté : Next.js, rien à changer.
3. Environment Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (et `NEXT_PUBLIC_DASHBOARD_URL` plus tard, si le tableau de bord vit ailleurs ; `NEXT_PUBLIC_POSTHOG_KEY` et `NEXT_PUBLIC_POSTHOG_HOST` pour le suivi produit, voir la section 13).
4. Deploy. Tu obtiens une URL du type `merry-brief.vercel.app`.
5. Settings > Domains : ajoute `app.withmerry.com`, puis crée l'enregistrement CNAME indiqué chez ton registrar. Reporte cette URL dans Supabase > Authentication > URL Configuration.

## 4. Relier Squarespace

Chaque bouton « C'est parti ! » du site pointe vers `https://app.withmerry.com`. Aucun bloc de code, aucun forfait particulier : un lien suffit. Pour savoir d'où viennent les couples, ajoute un paramètre, par exemple `https://app.withmerry.com/?src=hero` ; il est enregistré dans la colonne `source`.

## 5. Pages

- `/` : le choix de la fête (seul le mariage est ouvert), le parcours en sept écrans, puis l'écran de bienvenue.
- `/connexion` : connexion au tableau de bord (bouton « Connexion » du site), mot de passe oublié, et création d'accès pour un organisateur invité (`/connexion?invitation=…`).
- `/dashboard` : le tableau de bord (voir la section 8).
- `/f/<adresse>` : le formulaire invités public (voir la section 9).

## 6. Lire les briefs

Supabase > Table Editor > `briefs`. Les colonnes `status`, `owner` et `notes` sont là pour le suivi à la main. Pour recevoir un mail ou un message Slack à chaque nouveau brief : Supabase > Database > Webhooks, sur `insert` de `briefs`, vers un webhook Slack ou Make/Zapier.

## 7. L'email de la moitié

`partner_email` est enregistré avec le brief. Au premier passage sur le tableau de bord, la moitié devient organisatrice « en attente » : son lien personnel se copie ou s'envoie par mail depuis « Inviter un organisateur ». Merry n'envoie pas encore de mail lui-même.

## 8. Tableau de bord

Les écrans suivent le canvas « Merry · Carte brief », page Dashboard, validée le 21 octobre 2026.

| Page | Contenu |
|---|---|
| `/dashboard` | Accueil : compte à rebours, indicateurs au choix, modules, tâches de la semaine, « Bien démarrer », prochain paiement |
| `/dashboard/invites` | Liste des invités (une ligne par personne), groupes, réponse par moment du mariage, colonnes ajoutées, tout se modifie en cliquant |
| `/dashboard/invites/importer` | Import d'Excel, CSV ou texte collé, détection des doublons ; photos et PDF lus par l'IA si la clé est configurée |
| `/dashboard/invites/exporter` | Export Excel, CSV ou PDF, colonnes au choix (raccourcis traiteur, faire-part, plan de table) |
| `/dashboard/invites/formulaire` | Réglages du formulaire invités : questions (non demandé, facultatif, obligatoire, intitulés modifiables), moments affichés, questions ajoutées, photo d'en-tête, petit mot, date limite, thème, lien à copier |
| `/dashboard/retroplanning` | Grandes dates (fiançailles, mairie, dîner de la veille, jour J, brunch, fête entre amis ; demandées à la première visite, chacune ajoute ses tâches type), frise mois par mois avec le nombre de tâches et les dates épinglées, tâches par mois, « Qui fait quoi » |
| `/dashboard/budget` | Indicateurs, répartition par payeur et par poste, prochains paiements, tableau des postes avec écart vs budget, coût par invité, devis et factures ; un poste peut avoir plusieurs lignes (Lieu : tentiste, groupe électrogène, foodtruck…) |
| `/dashboard/budget/importer` | Import des devis signés et des factures réglées : Merry lit chaque document, puis trois questions par document (devis ou facture, qui a payé, on a bien lu ?) avant de remplir le poste, le prestataire, les paiements, les échéances et le dossier « Factures et devis ». Un devis non signé est seulement rangé, pour la comparaison |
| `/dashboard/budget/paiement/[poste]` | Effectuer un paiement (qui paie, quand, comment) et prévoir les échéances. Merry suit les paiements, il ne les encaisse pas encore |
| `/dashboard/budget/prestataires/[id]` | Fiche prestataire : contact (rempli par l'IA depuis un devis ou une facture : interlocuteur, téléphone, mail, site, RIB, montant du devis, échéances), résumé des échanges, fil des messages, documents (import ou choix dans Documents), bouton « Effectuer un paiement » |
| `/dashboard/documents` | Dossiers partagés (Factures et devis, Mairie, Préparation religieuse…), recherche, documents ajoutés récemment (voir la section 10) |
| `/dashboard/documents/[id]` | Un dossier : « D'où vient le document ? » (fichiers de l'ordinateur ou du téléphone, lien Drive/Dropbox, scan d'un papier en PDF), liste des documents, renommer, déplacer, supprimer |
| `/dashboard/indicateurs/accueil` et `/budget` | Choix des indicateurs (cinq au maximum) |

**Installer** : Supabase > SQL Editor > New query, colle `supabase/dashboard.sql`, Run (après `schema.sql`, le fichier peut être relancé sans risque). Au premier passage, chaque compte reçoit un mariage créé à partir de son brief : organisateurs, moments, groupes, postes de budget et rétroplanning type.

**Brief vide chez les organisateurs (correctif)** : si la page Brief est vide et que la région et le style manquent, lance `supabase/merry-brief-sans-help.sql` (Supabase > SQL Editor, Run, après `dashboard.sql` et `onboarding-simplifie.sql`, relançable). La fonction `merry_brief` renvoyait encore la colonne `help`, supprimée par `onboarding-simplifie.sql`, et échouait pour tous les organisateurs. Une installation neuve avec le `dashboard.sql` actuel n'en a pas besoin.

**Colonnes ajoutées** : chaque colonne a un auteur et un format. « Rempli par les invités » ajoute la question au formulaire invités (texte libre ou réponses prédéfinies) ; « Pour les organisateurs » reste interne, en texte libre ou avec des réponses prédéfinies (« Oui / Non / Ne sait pas » par défaut) choisies d'un clic dans la case. Installer : Supabase > SQL Editor, colle `supabase/colonnes.sql`, Run (relançable). Sans lui, les colonnes restent du texte libre pour les organisateurs. Les colonnes se déplacent (glisser l'en-tête) et s'élargissent (poignée à droite) ; cet ordre et ces largeurs sont propres à chaque navigateur.

**Réponses du rétroplanning gardées, plusieurs lignes par poste** : `supabase/reponses-et-lignes.sql` (Supabase > SQL Editor, Run, après `dashboard.sql`, relançable). Il crée `retro_answers` (une ligne par mariage : les réponses aux quatre questions de « Générer mon rétroplanning » s'enregistrent à chaque clic et se retrouvent sur tous les appareils des organisateurs, avec qui les a saisies et d'où) et ajoute `budget_items.category` (le poste regroupant plusieurs lignes ; `label` reste le type de dépense). Sans lui, les réponses restent sur l'appareil (localStorage) et « Ajouter une ligne » explique quoi lancer ; le reste fonctionne. Un poste seul dont le nom est celui d'une catégorie en devient la « Prestation principale » : rien n'est modifié dans les données existantes.

**Organisateurs** : le couple, les parents, un témoin… ont tous les mêmes droits. Chacun reçoit un lien personnel (`/connexion?invitation=…`), utilisable une seule fois. Les règles d'accès sont dans la base (RLS) : un compte ne voit que les mariages dont il est organisateur.

**Supabase > Authentication > URL Configuration** : ajoute `https://<ton domaine>/connexion` dans Redirect URLs (lien « mot de passe oublié »).

**Lecture par l'IA (facultatif)** : import des listes d'invités et lecture des devis et factures sur la fiche prestataire. Ajoute `ANTHROPIC_API_KEY` dans Vercel (Settings > Environment Variables). Sans clé, l'import lit Excel, CSV et texte collé, et indique que les photos et PDF arrivent bientôt. `MERRY_AI_MODEL` permet de changer de modèle, `MERRY_AI_MODEL_FAST` (facultatif) en réserve un plus rapide aux tableaux et au texte collé. **Lecture en arrière-plan** : lance `supabase/imports.sql` dans le SQL Editor (relançable sans risque). Chaque import est alors lu côté serveur : l'organisateur peut quitter la page ou fermer l'application, une pastille le suit dans le tableau de bord et la liste l'attend à son retour. Sans ce fichier, l'import marche mais seulement si l'on reste sur la page. Sur la page d'import, « Tester la connexion à l'IA » vérifie la clé, le modèle, le compteur et la lecture en arrière-plan. Garde-fous : réservé aux organisateurs, 30 lectures par compte et par jour, un fichier par appel, photos réduites à 1600 px, PDF de 3 Mo au plus. Fixe aussi une limite de dépense dans la console Anthropic.

**À savoir** : les colonnes de suivi de `briefs` (`status`, `owner`, `notes`) restent lisibles par le couple qui a rempli le brief (règle d'origine de `schema.sql`). Les organisateurs invités, eux, ne lisent le brief que par la fonction `merry_brief`, sans ces colonnes. Avant d'écrire des remarques sensibles dans `notes`, il faudra les déplacer dans une table interne.

**Démo** : `/dashboard?demo=1` affiche le mariage d'exemple de la maquette, enregistré seulement dans le navigateur (`?demo=0` pour en sortir). En local sans `.env.local`, la démo s'affiche directement.

**Devis et factures (lecture par l'IA)** : même clé `ANTHROPIC_API_KEY` et même compteur quotidien que l'import des invités (route `/api/read-quote`, un document par appel, PDF de 3 Mo au plus, quatre premières pages au-delà). Sans clé, le couple remplit lui-même les montants à l'étape « On a bien lu ? ». Le RIB lu sur le document est gardé dans la fiche du prestataire (colonnes de `supabase/colonnes.sql`). L'Accueil affiche un bandeau « Des prestataires déjà réservés ? » tant que des postes n'ont pas de devis (fermable).

**Pas encore fait** : paiement des prestataires depuis Merry (Stripe), envoi de mails et de SMS par Merry, résumé des échanges écrit par l'IA. Les devis et factures du budget restent des liens ; les fichiers eux-mêmes se déposent dans le bloc Documents (section 10).

**Relier Squarespace** : le bouton « Connexion » du site pointe vers `https://<ton domaine>/connexion`.

## Modifier les questions et les couleurs

Tout le contenu est en haut de `components/Brief.js` (listes `EVENTS`, `STAGES`, `TEAMS`, `GUESTS`, `FORMATS`, `VIBES`, `BUDGETS`, `PANEL_WORDS`). Les couleurs et polices sont dans `app/globals.css` (variables `:root` : `--lime` est le vert-jaune du site).

## À vérifier avant de publier

- Les pages `https://www.withmerry.com/cgu` et `https://www.withmerry.com/confidentialite` existent (liens sur l'écran compte).
- L'adresse `bonjour@withmerry.com` existe (message d'erreur).
- L'envoi de l'invitation à la moitié se fait par lien, depuis le tableau de bord (voir point 7).
- `supabase/dashboard.sql` a été collé dans Supabase avant de déployer le tableau de bord.

## 9. Formulaire invités

Les écrans suivent le canvas « Merry · Carte brief », page Dashboard (2f et 2g), validés le 21 octobre 2026.

**Installer** : Supabase > SQL Editor > New query, colle `supabase/formulaire.sql`, Run (après `dashboard.sql`, relançable sans risque). Le fichier crée la table `guest_forms`, le dossier de stockage public `merry-covers` pour les photos d'en-tête et deux fonctions ouvertes sans compte. Tant qu'il n'est pas lancé, le reste du tableau de bord fonctionne et la page de réglages explique quoi faire.

**Principe** : un formulaire par mariage, créé à la première visite de « Formulaire invités ». Le lien (`https://<ton domaine>/f/stanislas-et-margue-k7q2`) se colle dans un groupe WhatsApp ou Facebook. Les réglages s'enregistrent tout seuls.

**Réponses** : chaque envoi passe par `merry_form_submit`. Un invité déjà dans la liste est reconnu par son prénom et son nom (sans tenir compte des majuscules) : sa ligne est complétée, sinon il est ajouté sans groupe. L'accompagnant devient un invité « +1 », avec les mêmes réponses aux moments ; son adresse est celle de l'invité si « Même adresse postale » est coché. Régime et allergies vont dans la colonne Régime. Enfants, hébergement, le petit mot et les questions ajoutées deviennent des colonnes de la liste (créées au premier envoi, au nom de la question).

**Garde-fous** : les visiteurs ne lisent aucune table, seulement le contenu du formulaire. Textes tronqués, réponse limitée à 20 Ko, 3 000 invités au plus par mariage. Il n'y a pas de captcha : un lien qui circule largement peut recevoir des réponses fantaisistes, que les organisateurs suppriment dans la liste.

**Pas encore fait** : envoi d'un mail de confirmation à l'invité, modification d'une réponse par un lien personnel, une adresse à la carte (le lien finit par quatre caractères tirés au hasard).

## 10. Documents

Les écrans suivent le canvas « Merry · Carte brief », page Dashboard (5 et 5b), validés le 21 octobre 2026.

**Installer** : Supabase > SQL Editor > New query, colle `supabase/documents.sql`, Run (après `dashboard.sql`, relançable sans risque). Le fichier crée la table `document_folders`, ajoute à `documents` les colonnes des fichiers déposés (dossier, chemin de stockage, taille, type, qui l'a ajouté) et le stockage privé `merry-documents`. Tant qu'il n'est pas lancé, la page Documents explique quoi faire et le reste du tableau de bord fonctionne.

**Principe** : les organisateurs créent des dossiers (suggestions au premier clic : Factures et devis, Mairie, Préparation religieuse, Lieu et traiteur…) et y déposent des fichiers, 25 Mo au plus chacun. Chaque fichier est rangé dans le stockage sous `<wedding_id>/<dossier>/…` ; seuls les organisateurs du mariage peuvent le lire, par un lien signé valable une heure. Tous les organisateurs ont les mêmes droits : ajouter, renommer, déplacer, supprimer. Supprimer un dossier supprime ses fichiers.

**Relié au budget** : les devis et factures ajoutés depuis le budget ou la fiche d'un prestataire (des liens) apparaissent aussi dans Documents, dans le pseudo-dossier « Devis et factures du budget » tant qu'ils ne sont pas déplacés, avec la pastille « Dans le budget ». Un fichier déposé peut être déplacé vers ce pseudo-dossier seulement s'il est déjà rattaché à un prestataire.

**Sources d'un document** : « Depuis cet ordinateur » (ou « Depuis le téléphone » : Fichiers, photothèque, Google Drive, iCloud, selon le sélecteur du système), « Drive, Dropbox ou un lien » (Merry garde l'adresse, sans copie) et « Scanner un papier » : photos prises avec l'appareil photo (`capture`), plusieurs pages, noir et blanc au choix, réunies dans le navigateur en un seul PDF (`lib/dash/pdf.js`, sans dépendance) puis déposées comme un fichier. Pas de détection des bords ni de redressement de la page. Pas de sélecteur Google Drive intégré (il demanderait une connexion OAuth) : le lien ou le sélecteur du téléphone font l'affaire.

**Pas encore fait** : rattacher un fichier déposé à un prestataire ou à un poste depuis la page Documents (passe encore par le budget), dossiers privés au couple, partage d'un dossier au conseiller, aperçu des fichiers dans la page.

## 11. Pense-bête

**Retiré du menu** le 28 octobre 2026 (artboards *10 · Invités, un seul espace*) pour alléger le tableau de bord : `/dashboard/pense-bete` ramène à l'accueil. La table `pense_bete_items` et les notes déjà saisies restent en base, rien n'est supprimé.

L'écran suivait le canvas « Merry · Carte brief », page Dashboard (6 et 6m), validé le 23 octobre 2026.

**Installer** : Supabase > SQL Editor > New query, colle `supabase/pense-bete.sql`, Run (après `dashboard.sql`, relançable sans risque). Le fichier crée la table `pense_bete_items`. Tant qu'il n'est pas lancé, la page Pense-bête explique quoi faire et le reste du tableau de bord fonctionne.

**Principe** : une liste à cocher en vrac (courses, idées, question à poser à un prestataire…), partagée entre tous les organisateurs. Chaque ligne garde qui l'a ajoutée ; un bouton crayon modifie le texte, une poubelle la supprime. Deux groupes : « À faire » puis « Cochées ».

**Pas encore fait** : catégories ou étiquettes, réordonnancement à la main.

## 12. Prestataires

Les écrans suivent le canvas « Merry · Carte brief », page Dashboard (7 à 7j pour l'ordinateur, 7m à 7v pour le téléphone).

| Page | Contenu |
|---|---|
| `/dashboard/prestataires` | Trouver des prestataires : « Votre brief » (une puce par réponse, qui mène au brief), « Préciser mes envies », onglets par catégorie (Lieux, Traiteurs, DJ et animation, Fleuristes, Photographes, Autres), vue Liste ou Carte (`?vue=carte`), fiche d'un lieu (`?fiche=<id>`), bandeau « Ma sélection » et « Demander les devis » |
| `/dashboard/prestataires/lieux` | La sélection de lieux, d'après le brief, avec « Affiner la sélection » |
| `/dashboard/prestataires/autour` | Autour de votre lieu : traiteurs, DJ, fleuristes et photographes près du lieu retenu, « Pas besoin » par catégorie |
| `/dashboard/prestataires/mes` | Mes prestataires : ceux gardés d'un cœur, où en est chaque demande, case à cocher pour la prochaine demande |
| `/dashboard/prestataires/demandes` | Vos demandes de devis : envoyée, réponse reçue, devis reçu |

**Installer** : Supabase > SQL Editor > New query, colle `supabase/prestataires.sql`, Run (après `dashboard.sql`, relançable sans risque). Le fichier crée `vendor_picks` (la sélection du couple), `vendor_wishes` (les envies et les catégories « Pas besoin », une ligne par mariage) et `quote_requests` (les demandes envoyées), avec les mêmes droits pour tous les organisateurs, et la fonction `merry_place`, qui traduit le lieu ou la région saisis dans le brief (texte libre : « etretat », « Saint Georges sur Loire (49) », « Pays Basque ») en coordonnées d'après le catalogue. Tant qu'il n'est pas lancé, les pages Prestataires l'expliquent et le reste du tableau de bord fonctionne.

**Dates d'une demande de devis** : une date souhaitée et deux dates de repli, ou « Nos dates sont flexibles » (artboards 7h et 7t, dates flexibles) : un ou plusieurs mois, une ou plusieurs années. La période part dans le message (« Dates flexibles : juin ou juillet 2027 ») et dans `quote_requests.dates`, sans changement de schéma. Le message par défaut suit les dates tant que le couple ne l'a pas réécrit.

**D'où viennent les propositions** : du catalogue Merry (`supabase/catalog.sql`, schéma `catalog`), seulement les prestataires au statut `active`, à environ 100 km du lieu ou de la région du brief (`merry_place` ; sans elle, la région filtre par son nom), ceux avec photo d'abord, photos en liens signés. Le schéma doit être exposé : Supabase > Project Settings > API > Exposed schemas, ajouter `catalog`. Tant que le catalogue n'a aucun prestataire validé pour la catégorie, la page montre la sélection d'exemple du canvas (`lib/dash/catalog.js`) avec la mention « Sélection d'exemple ». Six lieux, ou huit prestataires, à la fois : « Voir plus » charge la page suivante (sous la grille, dans les listes de la carte, au bout de chaque rangée d'« Autour de votre lieu »). La carte s'ouvre sur les prestataires trouvés ; on la déplace en glissant, on zoome en pinçant (pavé tactile, deux doigts sur téléphone), avec Ctrl + molette ou les boutons, jusqu'à voir toute la France ; « Rechercher dans cette zone » cherche dans le catalogue la zone affichée. Fond de carte : départements (france-geojson, Licence Ouverte) et pays voisins (Natural Earth) dans `lib/dash/franceMap.js`, chargé seulement avec la carte.

**Principe** : le cœur garde un prestataire (avec un instantané de son nom, sa photo et son prix). Une demande de devis est un message, adapté à chacun (un mot personnel, les questions de sa catégorie, les dates, le budget si on le partage) : elle crée ou retrouve le prestataire dans le budget (`vendors`) et range le message sur sa fiche (`/dashboard/budget/prestataires/[id]`). Le statut se lit ensuite dans les données existantes : une réponse notée sur la fiche donne « Réponse reçue », un devis dans le budget (ou `vendor_picks.quote_amount`) « Devis reçu ». Le lieu retenu est celui du brief (`weddings.venue`), sinon le premier lieu dont on a le devis. Les critères de « Votre style » sont tirés de la description par mots-clés, sans IA.

**Critères du couple, appliqués à la lettre** (`lib/dash/filters.js`) : chaque choix de « Préciser mes envies » est un filtre strict sur le catalogue. Un lieu qui contredit un critère n'est jamais proposé. Viennent d'abord les lieux qui tiennent tous les critères, preuve à l'appui ; puis, sous « À confirmer avec le lieu », ceux dont une information manque (avec la liste de ce qu'il faut leur demander). Critères : région (une ou plusieurs, parmi les 13 régions de France métropolitaine ; utile quand le brief n'en donne pas), places assises et couchages au moins, traiteur libre ou imposé, parking, accès PMR, cérémonie en extérieur, exclusivité, fin de soirée après 2 h, aéroport et gare TGV à moins de N minutes (temps de route réel), ville à moins de N minutes (estimation prudente, 1,9 min par km à vol d'oiseau, que 95 % des trajets réels respectent). « Pas de chemin de terre » a été retiré : aucune source ne permet de le vérifier.

**Installer** : Supabase > SQL Editor, colle `supabase/catalog-filtres.sql`, Run (après `catalog.sql`, relançable). Il crée `catalog.transport_hubs` (47 aéroports à vols réguliers, OurAirports ; 182 gares TGV, data.gouv.fr, Licence Ouverte, positions corrigées d'après la liste officielle SNCF « Gares de voyageurs »), les colonnes d'accès des lieux (aéroport et gare TGV les plus proches, km et minutes de route) et les colonnes de filtre, générées à partir de `details` (rempli par `scripts/catalog/10-structure.mjs`) : elles suivent toutes seules les nouvelles lectures de sites. Puis `node scripts/catalog/11-acces.mjs --upload` calcule les temps de route (OSRM, serveur public d'OpenStreetMap, un appel par seconde, lots de 40 lieux ; relançable) et les enregistre. Sans le fichier SQL, les pages le disent et ne filtrent que par région.

**Positions rapides** : Supabase > SQL Editor, colle `supabase/lieux-rapides.sql`, Run (après `prestataires.sql`, relançable). `merry_place` (« Bordeaux », « Luberon », « (49) » traduits en coordonnées) lisait tout le catalogue à chaque appel, 30 s, au-delà du délai de 8 s de l'API : la ville du couple restait sans position et aucun lieu n'apparaissait. Le fichier précalcule les positions moyennes des lieux, villes, départements et régions dans `catalog.place_centers` (vue matérialisée, non exposée par l'API) ; `merry_place` y lit une ligne. Après un nouvel import du catalogue : `refresh materialized view catalog.place_centers;`. Si `prestataires.sql` est relancé, relancer `lieux-rapides.sql` après.

**Ce que l'IA compare** (en réserve : `NEXT_PUBLIC_MERRY_AI_MATCH=1` pour l'activer) (`app/api/prestataires/match`, `lib/dash/match.js`) : pour chaque lot de 24 prestataires proches, Claude note de 0 à 100 à quel point chacun correspond au couple (brief, envies, description libre de « Ajouter des précisions »), d'après ce que le catalogue sait de lui (catégories Google, ville, distance, avis, description, site). La liste suit la note ; sous 30 (pas fait pour un mariage, trop loin, hors sujet), le prestataire n'est pas proposé ; le premier, à 75 ou plus, porte « Meilleur match ». La note écrit aussi la phrase « Pourquoi ce lieu » des cartes et, sur la fiche, une explication et ce qu'il reste à vérifier avec le prestataire. Elle est gardée dans `vendor_matches` (partie E de `supabase/prestataires.sql`, à relancer) par mariage et par version des envies : changer ses précisions relance la comparaison, revenir sur la page ne la repaie pas. Même clé `ANTHROPIC_API_KEY` et même compteur quotidien que les autres lectures par l'IA (200 appels par compte et par jour pour cette route) ; `MERRY_AI_MODEL_FAST` choisit le modèle s'il est défini. Sans clé, la liste reste celle du catalogue (avec photos d'abord), sans note ni explication. Le catalogue n'a pas encore de vecteurs (`embedding`) : la recherche sémantique passe par cette comparaison, pas par une recherche vectorielle.

**Démo** : `/dashboard/prestataires?demo=1` reprend l'état du canvas (demandes envoyées il y a une semaine, réponses du Mas de la Source et de Duo Lavande, quatre prestataires pas encore contactés).

**Pas encore fait** : recherche vectorielle dans tout le catalogue (il faudra d'abord enrichir les fiches et calculer les vecteurs), envoi des demandes par mail (elles sont seulement rangées sur la fiche du prestataire), comparaison côte à côte des lieux et des devis (« Comparer », « Comparer les devis » préviennent que cela arrive), avis des couples, critères de style lus par l'IA, fond de carte hors du Sud-Est.

**Vos critères** (`lib/dash/criteria.js`, `components/dash/Criteria.js`) : une seule boîte en haut de Prestataires et de Lieux. Chaque critère est une puce modifiable sur place. Lieu, date, invités, budget et style sont ceux du brief : modifiés ici, ils le sont aussi dans le Brief (date, lieu et budget total sur `weddings`, fourchette d'invités, budget et style sur `briefs`). Le lieu est un seul critère : des régions, ou près d'une ville, ou un endroit libre ; choisir des régions remplace l'endroit du brief. Le reste (accès, places, couchages, fin de soirée, traiteur…) s'ajoute par « Préciser mes envies » et arrive dans la même boîte. Le nombre d'invités est partout la fourchette du brief (cartes, fiche, message de devis) ; la liste d'invités n'est qu'une indication. Chaque critère a son icône, la même sur les cartes, dans la fiche et dans « Pourquoi ce lieu » ; les faits d'un lieu qui y répondent sont en lime.

**Commentaires des organisateurs** : sur chaque prestataire, dans Mes prestataires et dans sa fiche, avec réponses (comme les commentaires des tâches du rétroplanning). Supabase > SQL Editor, colle `supabase/commentaires-prestataires.sql`, Run (après `prestataires.sql`, relançable). Il crée `vendor_comments` et la fonction `merry_save_brief`, qui laisse chaque organisateur modifier les réponses du brief depuis « Vos critères » ; sans elle, seul celui qui a rempli le brief le peut, et la page le dit.

**Catégories** : les onglets suivent `primary_category`, un prestataire n'apparaît que dans celui-là. `supabase/categories-principales.sql` (relançable) corrige les fiches mal classées à l'import : lieux de réception rangés en traiteurs et traiteurs rangés en lieux, d'après la première catégorie Google ; les fiches revendiquées dans l'espace prestataire ne sont pas touchées.

**Photo de couverture d'un lieu** : la plus large des photos (paysage d'abord), pour une grille régulière ; si le lieu a rangé ses photos depuis l'espace prestataire, son ordre est gardé.

## 13. Suivi produit (PostHog)

Qui s'est connecté et quand, le parcours d'un couple ou d'un organisateur (clics, temps passé, replay visuel de la session) et l'entonnoir d'onboarding (à quelle question les couples abandonnent).

**Installer** (10 minutes) :

1. Crée un compte sur [eu.posthog.com](https://eu.posthog.com) (hébergement UE ; c'est important, les briefs contiennent des données personnelles de couples européens).
2. Crée un projet (« Merry » par exemple), puis Project Settings > copie la « Project API Key ».
3. Colle-la dans `.env.local` (`NEXT_PUBLIC_POSTHOG_KEY=...`) et dans Vercel (Settings > Environment Variables), avec `NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com`.
4. Dans le projet PostHog, Project Settings > Recordings : vérifie que « Record user sessions » est activé (c'est la case qui permet le replay).

Sans cette clé, rien n'est envoyé (le code ne fait aucun appel réseau vers PostHog) : l'appli fonctionne à l'identique.

**Ce qui est déjà branché dans le code** :

- `lib/analytics.js` initialise PostHog une fois (`components/PostHogProvider.js`, chargé dans `app/layout.js`). Les clics et les pages vues sont suivis automatiquement (autocapture de PostHog), ainsi que le replay de session ; le contenu tapé dans les champs (email, mot de passe, budget…) n'est jamais enregistré (`maskAllInputs`).
- `lib/dash/store.js` identifie la personne (`posthog.identify`, avec son email et son prénom) dès que le tableau de bord est chargé, et réinitialise (`posthog.reset`) à la déconnexion.
- `components/Brief.js` envoie un événement `onboarding_step_viewed` à chaque écran de l'onboarding (avec `step` et `step_key` : `fete`, `equipe`, `essentiel`, `compte`), puis `onboarding_completed` ou `onboarding_signup_failed`.

**Pour lire les résultats dans PostHog** :

- *Qui est connecté, et son parcours* : Persons (ou People), cherche le prénom ou l'email, ouvre la personne > onglet « Session recordings » pour le replay clic par clic, et « Activity » pour la liste des pages et clics avec horodatage.
- *L'entonnoir d'onboarding* : Product analytics > Insights > New insight > Funnel, ajoute les étapes dans l'ordre à partir de `onboarding_step_viewed` (filtré par `step_key`, une étape par écran) puis `onboarding_completed` en dernière étape. PostHog affiche le nombre et le pourcentage de perte à chaque question.

**Consentement** : `components/CookieBanner.js` (chargé dans `app/layout.js`) demande l'accord une fois, avec « Refuser » et « Accepter » au même niveau. Tant que la personne n'a pas accepté, PostHog n'est pas initialisé : aucun cookie, aucun événement, aucun replay. Le choix est gardé dans le navigateur (`localStorage`, clé `merry-cookies`) ; sans clé PostHog, le bandeau ne s'affiche pas. Conséquence : l'entonnoir et les replays ne comptent que les personnes qui ont accepté.

**Pas encore fait** : tableau de bord interne dans Merry (on passe par l'interface PostHog pour l'instant, suffisante pour le volume actuel).

## 14. Espace prestataire (`/pro`)

L'espace des prestataires inscrits sur Merry (maquettes « Espace prestataire », page *Vendors Dashboard* du canvas, V0 à V9, ordinateur et téléphone). Séparé du tableau de bord des couples : sa propre adresse, ses dossiers (`app/pro`, `components/pro`, `lib/pro`, `app/pro/pro.css`, `app/api/pro`) et ses tables (`pro_…`). Rien n'y mène depuis le tableau de bord des couples : on y arrive par le lien direct, par exemple `https://merry-brief.vercel.app/pro`. Mêmes comptes Supabase, mais seules les fiches rattachées au compte (`pro_members`) s'ouvrent.

| Page | Contenu |
| --- | --- |
| `/pro` sans compte | Revendiquer sa fiche (V0) : retrouver son établissement par son nom ou son SIRET, puis un code à 6 chiffres envoyé à l'adresse mail de la fiche. Sert aussi de connexion quand on revient. |
| `/pro` sans compte, « Créer ma fiche » | Créer sa fiche (V0c) pour un établissement absent du catalogue : nom, activité, adresse, adresse mail, téléphone et SIRET facultatifs, puis le code reçu à cette adresse. L'adresse est placée sur la carte par la Géoplateforme de l'IGN ; la fiche est créée active dans `catalog.vendors`, visible des couples tout de suite, et s'ouvre dans Ma fiche. Si une fiche active porte déjà cette adresse mail, c'est elle qui est rattachée. |
| `/pro` | Accueil (V1) : fiche complète à … %, demandes à traiter, couples à relancer, prochaines dates réservées, chiffres du mois, crédits |
| `/pro/fiche` | Ma fiche (V2) : photos (la première sert de couverture, glisser pour l'ordre), vidéo ou visite virtuelle, présentation, style, capacités, traiteur, fin de soirée, accès. `?apercu=1` : aperçu côté couples (V2b), avec la carte et la fiche des couples |
| `/pro/tarifs` | Formules (haute et basse saison), options, saisons (V3). Le prix le plus bas devient le « À partir de » des couples |
| `/pro/disponibilites` | Calendrier : libre, option (avec sa fin) ou réservé ; lien d'agenda privé pour Google Agenda, Apple Calendrier ou Outlook (V4) |
| `/pro/demandes` | Les demandes de devis des couples (V5) : leur brief, leur message, leurs dates ; réponse avec un PDF ou un devis calculé depuis les formules, et option posée sur la date |
| `/pro/clients` | Suivi par étape, de la demande à la réservation (V6), fiche du client avec notes, messages et documents ; clients « Hors Merry » ajoutés à la main |
| `/pro/projets` | Projets de mariage (V7) : couples de la région qui acceptent d'être contactés, prénoms et message masqués jusqu'au déblocage en crédits |
| `/pro/credits` | Solde, formules d'abonnement, packs, historique (V8) |
| « Proposer une fonctionnalité » | Un mot à l'équipe Merry, avec une capture si besoin (V9), et l'état des propositions envoyées |

Démo sans compte : `/pro?demo=1` (données des maquettes, gardées dans le navigateur) ; `/pro?demo=1&revendiquer=1` pour les écrans V0 et V0c (en démo, aucun code n'est envoyé).

**Installer** :

1. Supabase > SQL Editor, colle `supabase/espace-prestataire.sql`, Run (après `catalog.sql`, `catalog-filtres.sql`, `prestataires.sql` et `lieux-rapides.sql` ; relançable). Il crée les tables `pro_…`, les fonctions `pro_…`, le stockage privé `pro-fichiers` (vidéos, devis, captures), les droits des prestataires sur leur dossier de `catalog-photos`, et recrée les colonnes `outdoor_ceremony` et `parking` du catalogue pour que le choix du prestataire passe avant ce que Merry a lu sur son site (une seule réécriture de la table). Tant que le fichier n'est pas lancé, `/pro` le dit et renvoie vers la démo.
2. Vercel > Settings > Environment Variables : `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API keys, clé `service_role`). Le serveur s'en sert pour lire l'adresse mail d'une fiche sans la montrer, rattacher la fiche au compte, signer les photos de la recherche, et servir l'agenda iCal. Sans elle, la vérification et l'agenda répondent qu'ils ne sont pas branchés.
3. Supabase > Authentication > Emails > Magic Link : le mail doit contenir le code, par exemple « Votre code Merry : {{ .Token }} ». Le code fait 6 chiffres (Authentication > Providers > Email > Email OTP Length). Le service d'envoi intégré de Supabase est limité à quelques mails par heure : brancher un SMTP (Resend…) avant d'ouvrir l'espace à beaucoup de prestataires.
4. Prix et crédits : Table Editor > `pro_offer` (une ligne). `plans` (prix mensuel et annuel, crédits par mois de Essentiel, Confort et Pro), `packs` (crédits et prix des trois packs), `unlock_cost` (crédits pour débloquer un projet ; vide = déblocage impossible), `explainer` (« Comment sont utilisés les crédits »). Vide = « à définir » à l'écran.

**Comment c'est relié aux couples** : quand un couple envoie « Demander les devis » à un lieu du catalogue, la demande apparaît dans les Demandes de ce lieu dès qu'il a revendiqué sa fiche (`pro_sync`), et devient un client « Nouvelle demande ». La réponse du prestataire (`pro_send`) arrive dans le tableau de bord du couple, sur la fiche du prestataire dans Budget, et compte comme « Réponse reçue ». Ce que le prestataire change dans Ma fiche et Tarifs est écrit dans `catalog.vendors` et se voit tout de suite dans la page Prestataires des couples. Les vues de la fiche viennent de `merry_log_view`, appelée quand un couple ouvre la fiche. Si le catalogue est réimporté par les scripts, ne pas écraser les fiches présentes dans `pro_vendors`.

**Pas encore fait** : le paiement (Stripe : abonnement et packs ; les champs de carte sont inactifs, rien n'est saisi), le code par SMS (il faut un fournisseur SMS, Twilio par exemple), l'écran où les couples acceptent d'être contactés (à dessiner dans le canvas ; d'ici là, Projets de mariage reste vide : colonnes `vendor_wishes.open_to_vendors` et `vendor_note`), l'ouverture côté couple des devis PDF (le message contient un lien valable 30 jours).

## 15. Site de mariage (`/s/…`)

Le lien que les couples donnent à leurs invités : le programme, le lieu et tout le pratique du week-end. Maquettes du canvas « Merry · Carte brief », page *Site de mariage · invités* : les huit modèles (1 à 8, ordinateur et téléphone) et les réglages du tableau de bord (9, ordinateur et téléphone).

**Installer** : Supabase > SQL Editor > New query, colle `supabase/site-mariage.sql`, Run (après `dashboard.sql`, relançable sans risque). Il crée la table `wedding_sites`, la fonction ouverte sans compte `merry_site_public` et, s'il n'existe pas encore, le stockage public `merry-covers` des photos (le même que le formulaire invités). Tant que le fichier n'est pas lancé, la page « Site de mariage » du tableau de bord explique quoi faire et le reste fonctionne.

**Dans le tableau de bord**, le site vit dans l'espace Invités (artboards *10 · Invités, un seul espace*, page Dashboard) : une seule entrée « Invités » dans le menu, puis quatre onglets dans l'ordre du parcours du couple, Liste des invités (`/dashboard/invites`), Site de mariage (`/dashboard/invites/site` : aperçu, état, lien, « Personnaliser le site »), Formulaire (`/dashboard/invites/formulaire`) et Liste de mariage (`/dashboard/invites/liste-de-mariage`, « Bientôt »). Pas de SQL nouveau.

**Éditeur** (`/dashboard/site`, artboards *9b · Éditeur du site*, ouvert par « Personnaliser le site » ; son retour ramène à l'onglet Site) : le site occupe l'écran, tel que les invités le verront, et s'écrit sur place.

| Zone | Contenu |
| --- | --- |
| Bandeau de gauche | Le modèle (Horizon, Terracotta, Perle, Embarquement, Colline, Belvédère, Moisson, Rivage ; celui du style du brief au départ), les couleurs (celles du modèle, blanc pur, très clair, sauge, rose poudré, bleu brume), la police (dix accords titre, écriture, texte), puis la liste des éléments du site, tous facultatifs (une case par rubrique). Chaque clic change le site tout de suite |
| Barre au-dessus du site | Aperçu ordinateur ou téléphone, l'adresse et « Copier le lien », l'état de l'enregistrement, la pastille « En ligne » (un clic met le site hors ligne : le lien affiche « Ce site n'est pas encore ouvert »), « Voir le site » |
| Le site | Un clic sur un texte l'écrit : prénoms, mot d'accueil, histoire, lieu, tenue, moments, questions, et aussi les petits titres du modèle (« Nous nous marions », « Notez la date »), gardés par modèle dans `content.labels` ; vider un petit titre remet celui du modèle. Un clic sur une photo la change. Au survol, chaque rubrique montre un carré noir (maintenir et glisser pour la déplacer), son nom, « Réglages » (les champs qui ne s'écrivent pas sur la page : heures et adresses des moments, listes venir / se loger, couleurs de la tenue, albums, témoins) et « Masquer » |
| Photos d'exemple | Tant qu'un emplacement de photo est vide, l'éditeur y montre une photo de mariage d'exemple (étiquette « Photo d'exemple »), pour voir ce qui va où ; les invités ne la voient jamais. 19 photos d'Unsplash (licence Unsplash, libre d'usage, sans attribution obligatoire) dans `public/site-exemples`, auteurs cités dans `lib/site/examples.js` |
| Téléphone | Le site plein écran ; en bas, Modèle, Couleurs, Police et Éléments ouvrent un tiroir. Toucher une rubrique montre son carré et ses outils |

Tout s'enregistre au fil de la frappe dans `wedding_sites` (`template`, `palette`, `fonts`, `sections`, `content`), sans nouveau fichier SQL. Les prénoms et la date viennent du mariage (des prénoms écrits sur le site ne changent que le site, `content.names`) ; les moments du programme sont ceux de la liste d'invités (le site y ajoute l'heure, le lieu, l'adresse et un petit mot, ou masque un moment ; un nom de moment récrit sur le site ne change que le site).

**Côté invités** : `/s/<adresse>` lit le site par `merry_site_public` (aucune table lisible). Une rubrique vide n'apparaît pas. « Votre réponse » rappelle à l'invité ce qu'il a répondu au formulaire (gardé sur son téléphone par `/f/<adresse>` après l'envoi), sinon l'invite à répondre ; sans formulaire en ligne, elle n'apparaît pas. Les boutons « Ajouter à mon agenda » (fichier .ics des moments), « Voir l'itinéraire » (Google Maps), le QR code et le partage WhatsApp marchent sans réglage. Démo : `/dashboard/site?demo=1`, puis « Voir le site ».

**Pas encore fait** : la liste de mariage et la cagnotte (rien sur le site pour l’instant ; les réglages les annoncent « bientôt »), la version anglaise (le sélecteur FR / EN des maquettes n'est pas affiché), une adresse à la carte (elle finit par quatre caractères tirés au hasard), le recadrage des photos.
