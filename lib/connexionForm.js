// Vérification du formulaire de connexion avant l'envoi. Le formulaire est en noValidate : sur iPhone, le refus natif
// du navigateur (champ requis, mail invalide, mot de passe trop court) ne s'affichait pas et le bouton semblait mort.
// Renvoie la clé du message d'erreur (lib/i18n/connexion.js), ou "" si tout va bien.
export function formError(mode, { firstName = "", email = "", password = "" }) {
  if (mode === "signup" && !firstName.trim()) return "firstNameMissing";
  if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "emailInvalid";
  if (mode === "forgot") return "";
  if (!password) return "passwordMissing";
  if (mode !== "login" && password.length < 8) return "passwordTooShort";
  return "";
}
