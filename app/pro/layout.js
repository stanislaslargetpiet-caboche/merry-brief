import "../dashboard/dashboard.css";
import "./pro.css";
import ProShell from "@/components/pro/Shell";
import NouvelleVersion from "@/components/NouvelleVersion";

export const metadata = {
  title: "Merry · Espace prestataire",
  description: "Votre fiche, vos tarifs, vos dates et les demandes des couples, au même endroit.",
  robots: { index: false, follow: false },
};

export default function ProLayout({ children }) {
  return (
    <>
      <ProShell>{children}</ProShell>
      <NouvelleVersion />
    </>
  );
}
