import "./pilotage.css";
import NouvelleVersion from "@/components/NouvelleVersion";

export const metadata = {
  title: "Merry · Pilotage",
  description: "Indicateurs internes de Merry.",
  robots: { index: false, follow: false },
};

export default function PilotageLayout({ children }) {
  return (
    <>
      {children}
      <NouvelleVersion />
    </>
  );
}
