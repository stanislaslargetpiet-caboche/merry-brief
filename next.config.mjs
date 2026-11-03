/** @type {import('next').NextConfig} */

// En-têtes de sécurité servis sur toutes les pages. La Content-Security-Policy est en mode « rapport seulement » :
// elle ne bloque rien, mais le navigateur signale (console) tout chargement hors de cette liste. À passer en
// bloquante, avec un nonce pour les scripts en ligne de Next, une fois la liste confirmée en production.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.weglot.com https://*.weglot.com https://eu.i.posthog.com https://eu-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.weglot.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.weglot.com https://*.posthog.com https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com",
  "frame-src 'self' https://calendly.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les pages ne sont pas conçues pour être intégrées ailleurs (le tableau de bord montre le site de mariage dans
  // sa propre fenêtre, même origine)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Plusieurs sessions Claude Code lancent chacune leur propre `next dev` dans ce même dossier ; sans ceci,
// elles partagent le même cache .next et se marchent dessus (fichiers manquants, 404 aléatoires). `next dev`
// passe par PORT (jamais `next build`/`next start`, qui restent sur `.next` pour Vercel) : un dossier de
// build par port isole chaque session.
const devPort = process.env.NODE_ENV !== "production" && process.env.PORT;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(devPort ? { distDir: `.next-dev-${devPort}` } : {}),
  // Navigateurs et robots demandent /favicon.ico sans lire la page : on sert l'icône générée (app/icon.js)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
