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
- `/dashboard` : page d'attente du tableau de bord. Connexion (email et mot de passe), lecture du brief du compte, premier aperçu. C'est cette page que le vrai tableau de bord viendra remplacer.

## 6. Lire les briefs

Supabase > Table Editor > `briefs`. Les colonnes `status`, `owner` et `notes` sont là pour le suivi à la main. Pour recevoir un mail ou un message Slack à chaque nouveau brief : Supabase > Database > Webhooks, sur `insert` de `briefs`, vers un webhook Slack ou Make/Zapier.

## 7. L'email de la moitié

`partner_email` est enregistré avec le brief. L'invitation elle-même (créer le second accès au même tableau de bord) n'est pas encore envoyée : elle demande la clé `service_role` côté serveur (`auth.admin.inviteUserByEmail`) et sera ajoutée avec le tableau de bord. L'écran de bienvenue ne l'annonce pas encore : ajoute la phrase quand l'envoi sera branché.

## Modifier les questions et les couleurs

Tout le contenu est en haut de `components/Brief.js` (listes `STAGES`, `TEAMS`, `GUESTS`, `VIBES`, `WEEKENDS`, `HONEYMOON_VIBES`, `BUDGETS`, `HELP`, `PANEL_WORDS`). Les couleurs et polices sont dans `app/globals.css` (variables `:root` : `--lime` est le vert-jaune du site).

## À vérifier avant de publier

- Les pages `https://www.merry.fr/cgu` et `https://www.merry.fr/confidentialite` existent (liens sur l'écran compte).
- L'adresse `bonjour@merry.fr` existe (message d'erreur).
- L'envoi de l'invitation à la moitié n'est pas encore branché (voir point 7).
