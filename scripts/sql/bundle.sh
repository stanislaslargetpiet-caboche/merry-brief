#!/usr/bin/env bash
# Assemble en un seul fichier, dans l'ordre, les fichiers SQL d'une mise à jour, pour un seul copier-coller
# dans Supabase > SQL Editor. Usage : scripts/sql/bundle.sh <nom> fichier1.sql fichier2.sql … > supabase/bundles/<nom>.sql
set -euo pipefail
cd "$(dirname "$0")/../.."
name="$1"; shift
echo "-- Merry · $name : fichier assemblé par scripts/sql/bundle.sh, ne pas modifier à la main (les sources sont dans supabase/)."
echo "-- À coller tel quel dans Supabase > SQL Editor > New query, puis Run. Relançable sans risque."
echo "-- Contenu, dans l'ordre : $*"
for f in "$@"; do
  echo
  echo "-- ======================================================================"
  echo "-- $f"
  echo "-- ======================================================================"
  cat "$f"
done
