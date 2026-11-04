// Mise en page commune des pages juridiques du site (confidentialité, conditions d'utilisation)

import Frame from "@/components/vitrine/Frame";
import LegalBody from "@/components/vitrine/LegalBody";

export default function Legal({ text, sections }) {
  return (
    <Frame current="legal">
      <LegalBody text={text} sections={sections} />
    </Frame>
  );
}
