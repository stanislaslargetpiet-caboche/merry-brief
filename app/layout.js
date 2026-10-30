import "./globals.css";
import { LangProvider } from "@/lib/lang";
import PostHogProvider from "@/components/PostHogProvider";
import CookieBanner from "@/components/CookieBanner";

export const metadata = {
  title: "Merry · Raconte-nous ton mariage",
  description:
    "Dix minutes de questions, et Merry te prépare un tableau de bord à la taille de ton mariage.",
  // Safari sur iPhone transforme sinon les mails et numéros affichés en liens (toute la ligne d'un organisateur devenait un lien mail)
  formatDetection: { email: false, telephone: false, address: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#cbff75",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Inter:wght@400;500;600;700&family=Climate+Crisis&display=swap"
        />
      </head>
      <body>
        <PostHogProvider>
          <LangProvider>
            {children}
            <CookieBanner />
          </LangProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
