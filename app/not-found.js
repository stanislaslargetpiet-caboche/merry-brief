import Link from "next/link";

export const metadata = { title: "Page introuvable | Merry", robots: { index: false, follow: false } };

// Page 404 de toute l'appli : lien, site ou formulaire disparu, adresse mal copiée
export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "48px 16px", textAlign: "center", fontFamily: "var(--font-body)" }}>
      <div style={{ maxWidth: 480 }}>
        <p style={{ fontFamily: "var(--font-logo)", fontSize: 28, margin: 0 }}>Merry</p>
        <h1 style={{ fontSize: 28, margin: "24px 0 12px" }}>Cette page n’existe pas.</h1>
        <p style={{ margin: "0 0 28px", lineHeight: 1.5, opacity: 0.75 }}>L’adresse a peut-être changé, ou le lien a été mal copié. Vérifiez-le, ou repartez de l’accueil.</p>
        <Link href="/" style={{ display: "inline-block", background: "#111", color: "#fff", textDecoration: "none", padding: "12px 20px", borderRadius: 999, fontWeight: 600 }}>
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
