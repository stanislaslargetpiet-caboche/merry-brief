// Le tableau de bord ne parle à Supabase que lorsque la session est confirmée et les données chargées.
// Tant que le compte n'est pas reconnu (status « loading », « signedout », « mustreset », « error »), rien ne part :
// les journaux Supabase du 15 novembre 2026 montraient, après chaque jeton de session perdu, des appels anonymes
// à merry_imports_cleanup refusés (401) parce que le fournisseur des imports se fiait au seul mode « live ».
export function isLive(dash) {
  return !!dash && dash.status === "ready" && dash.mode === "live";
}
