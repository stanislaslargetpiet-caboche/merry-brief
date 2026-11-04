# Templates Supabase Auth

Les 3 mails que Supabase envoie lui-même (confirmation d'adresse, mot de passe
oublié, code de connexion) ne passent pas par notre code — ils se configurent
dans le dashboard Supabase, pas dans ce repo. Ces fichiers sont le HTML à
coller là-bas, pour qu'ils reprennent le même format que les autres mails
(planches V24/V25/V27 du canvas, page « 7 - mails »).

## Où coller

Dashboard Supabase → **Authentication → Emails** (section "Email Templates").
Chaque template a un champ **Subject heading** et un champ **Message body (HTML
Editor)**.

| Template Supabase | Fichier | Objet (Subject heading) |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirmez votre adresse e-mail` |
| Reset Password | `reset-password.html` | `Réinitialisez votre mot de passe` |
| Magic Link | `magic-link-otp.html` | `{{ .Token }} est votre code Merry` |

« Magic Link » est le bon template pour le code de connexion : c'est celui
que Supabase utilise pour `signInWithOtp` (`app/api/pro/invitation/route.js`),
et il expose `{{ .Token }}`, le code à 6 chiffres — pas besoin du lien cliquable
qu'il propose aussi par défaut.

## À vérifier après collage

- **Durée du code** : le texte dit « Ce code n'est valable que quelques
  minutes. » sans donner de chiffre, pour ne pas inventer une durée. La vraie
  valeur se règle dans *Authentication → Settings → Email OTP Expiration* —
  si tu veux l'afficher en toutes lettres dans le mail, remplace la phrase par
  le nombre réel de minutes configuré là-bas.
- **Expéditeur** : ces mails partent par le SMTP que Supabase utilise
  aujourd'hui (son propre service, ou un SMTP personnalisé si un a déjà été
  branché dans *Authentication → Settings*), pas par Resend comme le reste
  des mails Merry — look identique, mais pas le même tuyau d'envoi.
- **Police** : Alan Sans n'est pas chargée ici (pas de `@font-face` fiable
  dans un mail), ces 3 templates restent sur la police système (Arial),
  comme tous les autres mails transactionnels Merry.
- **Preheader** : chaque fichier commence par un bloc invisible (`display:none`)
  qui donne l'aperçu affiché dans la liste des messages (Gmail, Apple Mail…),
  au lieu du premier bout de texte visible du mail. Les 6 autres mails Merry
  (ceux qui passent par Resend) ont le même traitement.
- **Mode sombre** : les 6 mails Resend forcent le mode clair (`<meta name="color-scheme" content="light">`
  + fond blanc explicite dans tout le document), pour éviter qu'un client en
  mode sombre inverse le fond sans toucher au texte encre et le rende
  illisible. Je n'ai pas fait pareil ici : je ne sais pas si l'éditeur HTML de
  Supabase accepte un document complet (`<!doctype html>…`) ou s'il attend un
  simple fragment comme ceux-ci — à vérifier en collant un de ces 3 fichiers
  avant d'y ajouter la même protection.
