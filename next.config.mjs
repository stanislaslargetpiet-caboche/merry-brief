/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Navigateurs et robots demandent /favicon.ico sans lire la page : on sert l'icône générée (app/icon.js)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

export default nextConfig;
