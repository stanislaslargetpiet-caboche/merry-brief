import Frame from "@/components/vitrine/Frame";
import AboutBody from "@/components/vitrine/AboutBody";

export const metadata = {
  title: "À propos",
  description: "On ne cessera jamais de se réunir. Merry met l’organisation entre tes mains, gratuitement.",
  alternates: { canonical: "https://www.withmerry.com/about" },
};

export default async function VitrineAPropos() {
  return (
    <Frame current="about">
      <AboutBody />
    </Frame>
  );
}
