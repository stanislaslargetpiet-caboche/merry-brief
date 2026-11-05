"use client";

// Menu des sections du pilotage, fixe en haut de page : la pastille de la section en cours passe en citron, en
// fondu, au fil du défilement. La section en cours est la dernière dont le haut a franchi le bas du menu ; en bas de
// page, c'est la dernière. Un clic défile en douceur jusqu'à la section (sans animation si le système la réduit).

import { useCallback, useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Section en cours d'après la position des sections : fonction pure, testée (tests/pilotageNav.test.js)
export function activeSection(tops, offset, atBottom) {
  if (!tops.length) return null;
  if (atBottom) return tops[tops.length - 1].id;
  let current = tops[0].id;
  for (const t of tops) if (t.top - offset <= 0) current = t.id;
  return current;
}

export default function PilotNav({ sections, offsetRef, ready }) {
  const [active, setActive] = useState(sections[0]?.id || null);
  const nav = useRef(null);

  const offset = useCallback(() => (offsetRef?.current?.getBoundingClientRect().height || 112) + 24, [offsetRef]);

  const compute = useCallback(() => {
    const tops = sections.map((s) => ({ id: s.id, top: document.getElementById(s.id)?.getBoundingClientRect().top })).filter((t) => typeof t.top === "number");
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const id = activeSection(tops, offset(), atBottom);
    if (id) setActive(id);
  }, [sections, offset]);

  useEffect(() => {
    if (!ready) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ready, compute]);

  // Sur téléphone la barre défile en largeur : la pastille en cours est ramenée au centre
  useEffect(() => {
    const el = nav.current;
    const on = el?.querySelector(".is-active");
    if (!el || !on || el.scrollWidth <= el.clientWidth) return;
    const box = el.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    el.scrollTo({ left: Math.max(0, b.left - box.left + el.scrollLeft - (el.clientWidth - b.width) / 2), behavior: reduced() ? "auto" : "smooth" });
  }, [active]);

  const go = (event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setActive(id);
    target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  };

  return (
    <nav ref={nav} className="pl-nav" aria-label="Sections">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} className={`pl-pill-link${active === s.id ? " is-active" : ""}`} aria-current={active === s.id ? "true" : undefined} onClick={(e) => go(e, s.id)}>
          {s.label}
        </a>
      ))}
    </nav>
  );
}
