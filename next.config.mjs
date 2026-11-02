/** @type {import('next').NextConfig} */

// En-têtes de sécurité servis sur toutes les pages. Pas de Content-Security-Policy stricte pour l'instant :
// Next injecte des scripts en ligne, et le site vitrine charge Weglot, PostHog et Google Fonts ; à ajouter avec
// un nonce quand ces chargements seront listés (un CSP mal réglé casserait la page sans prévenir).
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les pages ne sont pas conçues pour être intégrées ailleurs (le tableau de bord montre le site de mariage dans
  // sa propre fenêtre, même origine)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Navigateurs et robots demandent /favicon.ico sans lire la page : on sert l'icône générée (app/icon.js)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
