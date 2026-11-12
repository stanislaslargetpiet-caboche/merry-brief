// Mails V59 (après l'import, partager le formulaire) et V60 (formulaire publié) : leçon Mariages.net,
// D-305. Même mise en page que les autres mails couple (lib/server/mailTemplate.js).

import { renderMail } from "@/lib/server/mailTemplate";
import { mailShell } from "@/lib/server/mailShell";

function shell(subject, preheader, content) {
  return { subject, text: content.text, html: mailShell({ title: subject, preheader, body: renderMail(content) }) };
}

export function formulairePublieMail({ formLink }) {
  const title = "Ton formulaire est en ligne";
  const para1 = "Envoie le lien dans le groupe WhatsApp de la famille ou des amis : chaque réponse s'ajoute à ta liste avec l'adresse, le téléphone et la présence.";
  const para2 = "Le soir, tu reçois le récapitulatif des réponses de la journée.";
  return shell(title, para1, {
    title,
    paras: [para1, para2],
    cta: { label: "Copier le lien", href: formLink },
    why: "Tu reçois ce mail car tu viens de partager ton formulaire invités.",
    text: `${title}.\n\n${para1}\n\n${para2}\n\n${formLink}`,
  });
}

export function apresImportMail({ guestCount, duplicates, formLink }) {
  const plural = (n, un, plur) => (n === 1 ? un : plur || `${un}s`);
  const title = `${guestCount} ${plural(guestCount, "invité")} dans ta liste`;
  const dupLine = duplicates > 0 ? ` dont ${duplicates} ${plural(duplicates, "doublon")} à vérifier` : "";
  const para1 = `Ton import est fait : ${guestCount} ${plural(guestCount, "invité")}${dupLine} ${plural(guestCount, "est", "sont")} dans ta liste.`;
  const para2 = "L'étape suivante est de récupérer leurs adresses. Partage ton formulaire : chacun remplit les siennes, et elles arrivent directement dans ta liste.";
  return shell(title, "Prochaine étape : récupérer leurs adresses sans les demander une par une.", {
    title,
    paras: [para1, para2],
    cta: { label: "Partager mon formulaire", href: formLink },
    why: "Tu reçois ce mail car tu viens d'importer des invités.",
    text: `${title}.\n\n${para1}\n\n${para2}\n\n${formLink}`,
  });
}
