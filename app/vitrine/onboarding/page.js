import Frame from "@/components/vitrine/Frame";
import InvitesFinder from "@/components/vitrine/InvitesFinder";

export const metadata = {
  title: "Invités | Merry",
  description: "Tu es invité ? Retrouve la page de la fête avec ton code d’invitation ou les prénoms de ceux qui organisent.",
  alternates: { canonical: "https://www.withmerry.com/onboarding" },
};

export default async function VitrineInvites() {
  return (
    <Frame current="guests">
      <InvitesFinder />
    </Frame>
  );
}
