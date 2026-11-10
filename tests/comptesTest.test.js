import { describe, expect, it } from "vitest";
import { estAdresseTest, estCoupleTest } from "@/lib/server/comptesTest";

const env = { COMPTES_TEST: " Designee@Exemple.fr, autre.designee@exemple.fr " };

describe("comptes de test", () => {
  it("reconnaît les adresses de l'équipe, de test et celles désignées dans COMPTES_TEST", () => {
    for (const e of ["largetstan@gmail.com", "famille.larget-piet@exemple.fr", "h.codron@exemple.fr", "stanislas.largetpiet+revendication@gmail.com", "test.mariage@exemple.fr", "stan@withmerry.com", "designee@exemple.fr", "AUTRE.designee@exemple.fr"]) {
      expect(estAdresseTest(e, env), e).toBe(true);
    }
    for (const e of ["emma@exemple.fr", "celeste@exemple.fr", null]) expect(estAdresseTest(e, env), String(e)).toBe(false);
    expect(estAdresseTest("designee@exemple.fr", {})).toBe(false);
  });
  it("un couple est un test sans compte, créé par un compte de test ou fait de comptes de test seulement", () => {
    expect(estCoupleTest(null, [], env)).toBe(true);
    // Créé par Stan, une vraie cliente invitée dans l'équipe : test
    expect(estCoupleTest("stanislas.largetpiet@gmail.com", ["emma@exemple.fr", "stanislas.largetpiet@gmail.com"], env)).toBe(true);
    // Pas de créateur, un seul compte désigné : test
    expect(estCoupleTest(null, ["designee@exemple.fr"], env)).toBe(true);
    // Un vrai couple qui a invité Stan reste un vrai couple
    expect(estCoupleTest("astrid@exemple.fr", ["astrid@exemple.fr", "stanislas.largetpiet@gmail.com"], env)).toBe(false);
  });
});
