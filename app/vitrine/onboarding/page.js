import Frame from "@/components/vitrine/Frame";

export const metadata = {
  title: "Invités — Merry",
  description: "Tu es invité ? Retrouve la page de la fête avec ton code d’invitation ou les prénoms de ceux qui organisent.",
  alternates: { canonical: "https://www.withmerry.com/onboarding" },
};

export default async function VitrineInvites() {
  return (
    <Frame current="guests">
      <main className="wv-invites">
        <img src="/vitrine/invites-1.webp" alt="" className="wv-ph wv-ph1" />
        <img src="/vitrine/invites-2.webp" alt="" className="wv-ph wv-ph2" />
        <img src="/vitrine/invites-3.webp" alt="" className="wv-ph wv-ph3" />
        <img src="/vitrine/invites-4.webp" alt="" className="wv-ph wv-ph4" />
        <div className="wv-invites-in">
          <h1 className="wv-h2">Tu es invité au plus beau jour de leur vie.</h1>
          <p className="wv-h4">C’est pas rien.</p>
          <div className="wv-btns" style={{ justifyContent: "center", marginTop: 18 }}>
            <button type="button" className="wv-btn wv-btn-dark">
              J'ai un code
            </button>
            <button type="button" className="wv-btn wv-btn-line">
              J'ai un nom
            </button>
          </div>
        </div>
      </main>
    </Frame>
  );
}
