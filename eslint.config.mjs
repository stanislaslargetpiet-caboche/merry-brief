// ESLint 9 (configuration plate). Les règles Next.js (Core Web Vitals) et React Hooks sont encore livrées
// au format historique par eslint-config-next 15 : FlatCompat les traduit.
// `npm run lint` ; la CI échoue sur une erreur, pas sur un avertissement.
import { FlatCompat } from "@eslint/eslintrc";
import globals from "globals";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "scripts/catalog/**", "lib/vitrine/blocks/**"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    // Un nom jamais importé plante toute la page à l'exécution, et ni le build ni les tests ne le voient
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "no-undef": "error",
      // Les dépendances d'effets sont revues à la main dans ce code (références, flush) : un avertissement suffit
      "react-hooks/exhaustive-deps": "warn",
      // Les photos viennent du stockage signé et de Google : pas de next/image ici
      "@next/next/no-img-element": "off",
      // Textes français : les apostrophes et guillemets dans le JSX sont voulus
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
