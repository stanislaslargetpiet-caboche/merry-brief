// Section en cours dans le menu fixe du pilotage : fonction pure, testée (tests/pilotageNav.test.js).
// `tops` : position du haut de chaque section ; `offset` : bas du menu fixe ; `atBottom` : bas de page atteint.
export function activeSection(tops, offset, atBottom) {
  if (!tops.length) return null;
  if (atBottom) return tops[tops.length - 1].id;
  let current = tops[0].id;
  for (const t of tops) if (t.top - offset <= 0) current = t.id;
  return current;
}
