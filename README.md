# Merry · Onboarding et compte

Le parcours d'inscription des couples (choix de la fête + 7 écrans + bienvenue), à héberger sur Vercel et à relier aux boutons « C'est parti ! » du site Squarespace. Il crée le compte du couple (Supabase Auth, email et mot de passe) et enregistre le brief dans la table `briefs`. Les écrans suivent le canvas « Merry · Carte brief », page Onboarding, validé le 22 octobre 2026.

## 1. Supabase (15 minutes)

1. Crée un projet sur supabase.com (région EU, Francfort ou Paris).
2. SQL Editor > New query : colle le contenu de `supabase/schema.sql`, Run, puis de `supabase/onboarding-simplifie.sql`, Run.
3. Authentication > Providers > Email : laisse Email activé.
   Pour le lancement, désactive « Confirm email » (Authentication > Providers > Email > Confirm email) : le couple arrive sur son tableau de bord sans passer par sa boîte mail. Si tu le laisses activé, le code gère le cas (écran « vérifie ta boîte mail », brief envoyé à la première connexion).
4. Authentication > URL Configuration : Site URL = l'URL de l'appli (ex. https://app.merry.fr).
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
3. Environment Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (et `NEXT_PUBLIC_DASHBOARD_URL` plus tard, si le tableau de bord vit ailleurs).
4. Deploy. Tu obtiens une URL du type `merry-brief.vercel.app`.
5. Settings > Domains : ajoute `app.merry.fr`, puis crée l'enregistrement CNAME indiqué chez ton registrar. Reporte cette URL dans Supabase > Authentication > URL Configuration.

## 4. Relier Squarespace

Chaque bouton « C'est parti ! » du site pointe vers `https://app.merry.fr`. Aucun bloc de code, aucun forfait particulier : un lien suffit. Pour savoir d'où viennent les couples, ajoute un paramètre, par exemple `https://app.merry.fr/?src=hero` ; il est enregistré dans la colonne `source`.

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

- Les pages `https://www.merry.fr/cgu` et `https://www.merry.fr/confidentialite` existent (liens sur l'écran compte).
- L'adresse `bonjour@merry.fr` existe (message d'erreur).
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

L'écran suit le canvas « Merry · Carte brief », page Dashboard (6 et 6m), validé le 23 octobre 2026.

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

**Installer** : Supabase > SQL Editor > New query, colle `supabase/prestataires.sql`, Run (après `dashboard.sql`, relançable sans risque). Le fichier crée `vendor_picks` (la sélection du couple), `vendor_wishes` (les envies et les catégories « Pas besoin », une ligne par mariage) et `quote_requests` (les demandes envoyées), avec les mêmes droits pour tous les organisateurs. Tant qu'il n'est pas lancé, les pages Prestataires l'expliquent et le reste du tableau de bord fonctionne.

**D'où viennent les propositions** : du catalogue Merry (`supabase/catalog.sql`, schéma `catalog`), seulement les prestataires au statut `active`, près de la région du brief (ou du lieu retenu pour « Autour de votre lieu »), photos en liens signés. Le schéma doit être exposé : Supabase > Project Settings > API > Exposed schemas, ajouter `catalog`. Tant que le catalogue n'a aucun prestataire validé pour la catégorie, la page montre la sélection d'exemple du canvas (`lib/dash/catalog.js`) avec la mention « Sélection d'exemple ». Le fond de carte (`lib/dash/provenceMap.js`) couvre le Sud-Est, comme la maquette.

**Principe** : le cœur garde un prestataire (avec un instantané de son nom, sa photo et son prix). Une demande de devis est un message, adapté à chacun (un mot personnel, les questions de sa catégorie, les dates, le budget si on le partage) : elle crée ou retrouve le prestataire dans le budget (`vendors`) et range le message sur sa fiche (`/dashboard/budget/prestataires/[id]`). Le statut se lit ensuite dans les données existantes : une réponse notée sur la fiche donne « Réponse reçue », un devis dans le budget (ou `vendor_picks.quote_amount`) « Devis reçu ». Le lieu retenu est celui du brief (`weddings.venue`), sinon le premier lieu dont on a le devis. Les critères de « Votre style » sont tirés de la description par mots-clés, sans IA.

**Démo** : `/dashboard/prestataires?demo=1` reprend l'état du canvas (demandes envoyées il y a une semaine, réponses du Mas de la Source et de Duo Lavande, quatre prestataires pas encore contactés).

**Pas encore fait** : envoi des demandes par mail (elles sont seulement rangées sur la fiche du prestataire), comparaison côte à côte des lieux et des devis (« Comparer », « Comparer les devis » préviennent que cela arrive), avis des couples, critères de style lus par l'IA, fond de carte hors du Sud-Est.
