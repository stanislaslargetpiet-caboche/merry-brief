// Appel d'outil pour les lectures par l'IA (invités, devis, prestataires, icônes).
// Certains modèles refusent l'appel d'outil forcé : « tool_choice: type "tool" and "any" are not supported for this model ».
// On retient ces modèles, puis on passe en mode « auto » en demandant l'outil dans la consigne.

const NO_FORCE = new Set();

export const refusesForcedTool = (text) => /tool_choice/i.test(String(text || ""));
export const rememberNoForce = (model) => NO_FORCE.add(model);
export const isForced = (model) => !NO_FORCE.has(model);

// Complète la requête : outil forcé si le modèle l'accepte, sinon « auto » + consigne explicite
export function withTool(payload, tool) {
  if (isForced(payload.model)) return { ...payload, tools: [tool], tool_choice: { type: "tool", name: tool.name } };
  const nudge = `Réponds uniquement en appelant l'outil « ${tool.name} », sans autre texte.`;
  const messages = payload.messages.map((m, i) => {
    if (i !== payload.messages.length - 1 || m.role !== "user") return m;
    return { ...m, content: Array.isArray(m.content) ? [...m.content, { type: "text", text: nudge }] : `${m.content}\n\n${nudge}` };
  });
  return { ...payload, tools: [tool], tool_choice: { type: "auto" }, messages };
}
