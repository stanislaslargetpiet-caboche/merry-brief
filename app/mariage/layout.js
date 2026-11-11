import { LangProvider } from "@/lib/lang";
import HeaderChrome from "@/components/vitrine/HeaderChrome";
import FooterChrome from "@/components/vitrine/FooterChrome";
import "../vitrine/vitrine.css";
import "./mariage.css";

// Pages SEO : mêmes en-tête et pied de page que le site vitrine, pour pouvoir revenir à l'accueil et naviguer.
export default function MariageLayout({ children }) {
  return (
    <LangProvider>
      <div className="wv">
        <HeaderChrome />
        {children}
        <FooterChrome />
      </div>
    </LangProvider>
  );
}
