"use client";

import { useEffect, useRef } from "react";

// Menu déroulant bâti sur <details> : se referme quand on clique ailleurs ou avec Échap,
// ce qu'un <details> seul ne fait pas (le menu restait ouvert par-dessus la page).
export function useAutoClose(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onClick = (e) => {
      if (el.open && !el.contains(e.target)) el.open = false;
    };
    const onKey = (e) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}

export default function Dropdown({ className, summary, summaryLabel, children }) {
  const ref = useRef(null);
  useAutoClose(ref);
  return (
    <details ref={ref} className={className}>
      <summary aria-label={summaryLabel}>{summary}</summary>
      {children}
    </details>
  );
}
