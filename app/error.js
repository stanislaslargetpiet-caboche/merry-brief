"use client";

import { useEffect } from "react";
import { trackError } from "@/lib/analytics";

// Une erreur de rendu n'emporte plus toute la page : on l'affiche, on la journalise, et on propose de réessayer
export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error("[merry] erreur de page", error);
    trackError(error, { boundary: "page" });
  }, [error]);
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: "48px 16px", textAlign: "center", fontFamily: "var(--font-body)" }}>
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 26, margin: "0 0 12px" }}>Quelque chose s’est mal passé.</h1>
        <p style={{ margin: "0 0 28px", lineHeight: 1.5, opacity: 0.75 }}>Rien n’est perdu : vos données sont enregistrées au fur et à mesure. Réessayez ; si ça se reproduit, rechargez la page.</p>
        <button type="button" onClick={reset} style={{ background: "#111", color: "#fff", border: 0, padding: "12px 20px", borderRadius: 999, fontWeight: 600, cursor: "pointer" }}>
          Réessayer
        </button>
      </div>
    </main>
  );
}
