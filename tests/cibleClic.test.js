import { describe, expect, it } from "vitest";
import { decrireCible } from "@/lib/cibleClic";

// Élément de page minimal : balise, classes, parent, et closest() qui remonte jusqu'à un bouton ou un lien
function el(tag, classes = "", parent = null, attrs = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    parentElement: parent,
    getAttribute: (name) => (name === "class" ? classes : attrs[name] ?? null),
    closest: () => {
      for (let n = node; n; n = n.parentElement) if (["BUTTON", "A", "LABEL", "INPUT"].includes(n.tagName)) return n;
      return null;
    },
  };
  return node;
}

describe("élément visé par un clic de rage", () => {
  it("nomme le bouton qui contient le clic, par sa balise et ses classes", () => {
    const bouton = el("button", "gf-pill is-on", el("div", "gf-pills"));
    expect(decrireCible(bouton)).toBe("button.gf-pill.is-on");
    // Clic sur l'icône du bouton : c'est le bouton qui compte
    expect(decrireCible(el("svg", "", el("span", "", bouton)))).toBe("button.gf-pill.is-on");
  });
  it("hors d'un bouton, nomme l'élément et son parent quand il n'a pas de classe", () => {
    expect(decrireCible(el("span", "", el("div", "pp-card")))).toBe("span dans div.pp-card");
    expect(decrireCible(el("div", "pp-card", el("main")))).toBe("div.pp-card");
  });
  it("ne laisse passer ni texte, ni identifiant, ni adresse : seulement la balise et des classes simples", () => {
    const lien = el("a", "pro-link w-[42px] marie.dupont@exemple.fr a b c", null, { href: "/f/jeton-secret", id: "invite-42", "aria-label": "Marie Dupont" });
    expect(decrireCible(lien)).toBe("a.pro-link.a.b");
  });
  it("rend null sans élément", () => {
    expect(decrireCible(null)).toBe(null);
    expect(decrireCible({})).toBe(null);
  });
});
