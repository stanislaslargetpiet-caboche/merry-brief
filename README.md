# Merry · Onboarding et compte

Le parcours d'inscription des couples (10 écrans + bienvenue), à héberger sur Vercel et à relier aux boutons « C'est parti ! » du site Squarespace. Il crée le compte du couple (Supabase Auth, email et mot de passe) et enregistre le brief dans la table `briefs`. Les écrans suivent le canvas « Merry · Carte brief », page Onboarding, validé le 21 octobre 2026.

## 1. Supabase (15 minutes)

1. Crée un projet sur supabase.com (région EU, Francfort ou Paris).
2. SQL Editor > New query : colle le contenu de `supabase/schema.sql`, Run.
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

- `/` : le parcours en dix écrans, puis l'écran de bienvenue.
- `/connexion` : connexion au tableau de bord (bouton « Connexion » du site), mot de passe oublié, et création d'accès pour un organisateur invité (`/connexion?invitation=…`).
- `/dashboard` : le tableau de bord (voir la section 8).

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
| `/dashboard/retroplanning` | Tâches par mois, cochées, attribuées, « Qui fait quoi » |
| `/dashboard/budget` | Indicateurs, répartition par payeur et par poste, prochains paiements, tableau des postes avec écart vs budget, coût par invité, devis et factures |
| `/dashboard/budget/paiement/[poste]` | Noter un paiement (qui paie, quand, comment) et prévoir les échéances. Merry suit les paiements, il ne les encaisse pas encore |
| `/dashboard/budget/prestataires/[id]` | Fiche prestataire : contact, résumé des échanges, fil des messages (envoi par la messagerie), documents, paiements |
| `/dashboard/indicateurs/accueil` et `/budget` | Choix des indicateurs (cinq au maximum) |

**Installer** : Supabase > SQL Editor > New query, colle `supabase/dashboard.sql`, Run (après `schema.sql`, le fichier peut être relancé sans risque). Au premier passage, chaque compte reçoit un mariage créé à partir de son brief : organisateurs, moments, groupes, postes de budget et rétroplanning type.

**Organisateurs** : le couple, les parents, un témoin… ont tous les mêmes droits. Chacun reçoit un lien personnel (`/connexion?invitation=…`), utilisable une seule fois. Les règles d'accès sont dans la base (RLS) : un compte ne voit que les mariages dont il est organisateur.

**Supabase > Authentication > URL Configuration** : ajoute `https://<ton domaine>/connexion` dans Redirect URLs (lien « mot de passe oublié »).

**Import par l'IA (facultatif)** : ajoute `ANTHROPIC_API_KEY` dans Vercel (Settings > Environment Variables). Sans clé, l'import lit Excel, CSV et texte collé, et indique que les photos et PDF arrivent bientôt. `MERRY_AI_MODEL` permet de changer de modèle.

**Démo** : `/dashboard?demo=1` affiche le mariage d'exemple de la maquette, enregistré seulement dans le navigateur (`?demo=0` pour en sortir). En local sans `.env.local`, la démo s'affiche directement.

**Pas encore fait** : paiement des prestataires depuis Merry (Stripe), envoi de mails et de SMS par Merry, dépôt de fichiers (les devis et factures sont des liens), résumé des échanges écrit par l'IA.

**Relier Squarespace** : le bouton « Connexion » du site pointe vers `https://<ton domaine>/connexion`.

## Modifier les questions et les couleurs

Tout le contenu est en haut de `components/Brief.js` (listes `STAGES`, `TEAMS`, `GUESTS`, `VIBES`, `WEEKENDS`, `HONEYMOON_VIBES`, `BUDGETS`, `HELP`, `PANEL_WORDS`). Les couleurs et polices sont dans `app/globals.css` (variables `:root` : `--lime` est le vert-jaune du site).

## À vérifier avant de publier

- Les pages `https://www.merry.fr/cgu` et `https://www.merry.fr/confidentialite` existent (liens sur l'écran compte).
- L'adresse `bonjour@merry.fr` existe (message d'erreur).
- L'envoi de l'invitation à la moitié se fait par lien, depuis le tableau de bord (voir point 7).
- `supabase/dashboard.sql` a été collé dans Supabase avant de déployer le tableau de bord.
