"use client";

// Dernier filet : une erreur dans la mise en page racine elle-même (rare). Doit rendre <html> et <body>.
export default function GlobalError({ reset }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "48px 16px", textAlign: "center" }}>
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: 26, margin: "0 0 12px" }}>Merry n’a pas pu s’afficher.</h1>
            <p style={{ margin: "0 0 28px", lineHeight: 1.5, opacity: 0.75 }}>Réessayez dans un instant.</p>
            <button type="button" onClick={reset} style={{ background: "#111", color: "#fff", border: 0, padding: "12px 20px", borderRadius: 999, fontWeight: 600, cursor: "pointer" }}>
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
