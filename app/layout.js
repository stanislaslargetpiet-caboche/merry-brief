import "./globals.css";

export const metadata = {
  title: "Merry · Raconte-nous ton mariage",
  description:
    "Dix minutes de questions, et Merry te prépare un tableau de bord à la taille de ton mariage.",
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
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=Climate+Crisis&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
