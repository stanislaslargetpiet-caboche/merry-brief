import "../form.css";
import { fetchPublicForm, formTitle } from "@/lib/formServer";
import { longDate } from "@/lib/dash/format";

// Titre, description et image affichés quand le lien est partagé (WhatsApp, Facebook, messages)
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const form = await fetchPublicForm(slug);
  const title = form ? formTitle(form) : "Répondre aux mariés";
  const when = form ? [form.wedding_date ? longDate(form.wedding_date) : null, form.venue].filter(Boolean).join(" · ") : "";
  const description = form ? `${when ? `${when}. ` : ""}Quelques questions pour les mariés, deux minutes suffisent.` : "Le formulaire des invités : quelques questions pour les mariés.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", locale: "fr_FR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function GuestFormLayout({ children }) {
  return children;
}
