"use client";

// Barre de liens qui défile en largeur (onglets des métiers, pastilles des zones) : au chargement, le lien de
// la page en cours est amené dans la partie visible. Les liens restent rendus côté serveur, dans le HTML ; ce
// composant ne fait que régler le défilement, sans animation et sans toucher au défilement de la page.

import { useEffect, useRef } from "react";

export default function ScrollNav({ children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const nav = ref.current;
    const on = nav?.querySelector('[aria-current="page"]');
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    const navBox = nav.getBoundingClientRect();
    const onBox = on.getBoundingClientRect();
    // Position du lien dans la barre, quel que soit le défilement déjà appliqué
    const left = onBox.left - navBox.left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, left - (nav.clientWidth - onBox.width) / 2);
  }, []);
  return (
    <nav ref={ref} {...props}>
      {children}
    </nav>
  );
}
