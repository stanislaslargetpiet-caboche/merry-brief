#!/usr/bin/env bash
# Vérifie les fichiers SQL de supabase/ sur un PostgreSQL vide : les migrations passent dans l'ordre du README,
# puis les scénarios de test (scripts/sql/test-*.sql) s'exécutent dans une transaction annulée.
# Usage : DATABASE_URL=postgres://postgres:postgres@localhost:5432/merry scripts/sql/check.sh
# Tous les fichiers du README, dans son ordre (le shim remplace auth, storage et les rôles de Supabase ; pas de PostGIS).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?DATABASE_URL manquante}"
FILES=(
  scripts/sql/00-supabase-shim.sql supabase/schema.sql supabase/onboarding-simplifie.sql supabase/onboarding-v2.sql
  supabase/dashboard.sql supabase/quotas.sql supabase/merry-brief-sans-help.sql supabase/colonnes.sql
  supabase/plan-de-table.sql supabase/sync-et-historique.sql supabase/relances.sql supabase/fiche-et-vues-invites.sql
  supabase/reponses-et-lignes.sql supabase/imports.sql supabase/formulaire.sql supabase/documents.sql
  supabase/pense-bete.sql supabase/prestataires.sql supabase/catalog.sql supabase/catalog-filtres.sql
  supabase/lieux-rapides.sql supabase/qualite-photos.sql supabase/commentaires-prestataires.sql supabase/categories-principales.sql
  supabase/espace-prestataire.sql supabase/pro-credits-reponse.sql supabase/prestataires-ajout-manuel.sql supabase/prestataires-ajout-manuel-google.sql
  supabase/prestataires-ajout-manuel-fix-ambiguite.sql supabase/prestataires-notifier-couple.sql supabase/mail-desinscriptions.sql supabase/mails-planifies.sql
  supabase/site-mariage.sql supabase/site-mariage-moisson.sql supabase/site-visites.sql supabase/invites-recherche.sql
  supabase/note-invites.sql supabase/mise-en-page.sql supabase/pro-fiche-categorie-correction.sql supabase/pilotage.sql
)
for f in "${FILES[@]}"; do
  if ! out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    echo "ÉCHEC $f"; echo "$out" | grep -v '^NOTICE' | tail -8; exit 1
  fi
  echo "ok   $f"
done
# Relançables : chaque fichier doit passer une seconde fois sans erreur
for f in supabase/pilotage.sql supabase/catalog.sql supabase/espace-prestataire.sql supabase/prestataires-notifier-couple.sql supabase/prestataires-ajout-manuel-fix-ambiguite.sql supabase/formulaire.sql supabase/invites-recherche.sql supabase/site-visites.sql supabase/quotas.sql supabase/plan-de-table.sql supabase/sync-et-historique.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1 || { echo "ÉCHEC (relance) $f"; exit 1; }
  echo "ok   $f (relancé)"
done
for t in scripts/sql/test-*.sql; do
  if ! out=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$t" 2>&1); then
    echo "ÉCHEC $t"; echo "$out" | tail -12; exit 1
  fi
  echo "ok   $t"
done
echo "SQL : tout passe"
