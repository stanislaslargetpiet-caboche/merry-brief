"use client";

// Chargement de l'espace prestataire (maquettes Vendor-Chargement et Vendor-Chargement-Tel, 6 nov. 2026) :
// le cadre s'affiche tout de suite, avec les mêmes classes que Frame (Shell.js), et la zone de page montre
// des blocs gris à la place du contenu. Les données du prestataire (nom, crédits, pastille de non-lus) n'étant
// pas encore là, elles restent de petites barres grises ; rien n'est actif ni cliquable.

import { Icon } from "@/components/dash/icons";
import { useAccent } from "@/lib/dash/accent";
import { ProIcon } from "./icons";

const Bar = ({ w, h = 12, r = 999 }) => <span className="p-sk" style={{ width: w, height: h, borderRadius: r }} />;

const Card = ({ children }) => <div className="p-sk-card">{children}</div>;

// nav : les entrées de PRO_NAV (Shell.js), passées en propriété pour ne pas importer Shell ici
export default function ProSkeleton({ nav }) {
  const accent = useAccent();
  return (
    <div className="d-root p-root" data-accent={accent}>
      <header className="p-top" aria-hidden="true">
        <span className="p-brand is-small">
          <span className="p-brand-logo">Merry</span>
          <span className="p-brand-sub">Espace prestataire</span>
        </span>
        <span className="p-top-right">
          <span className="p-credits-pill is-small">
            <Bar w={70} />
          </span>
        </span>
      </header>
      <nav className="p-tabs" aria-hidden="true">
        {nav.map((n) => (
          <span key={n.href} className="p-tab">
            {n.label}
          </span>
        ))}
      </nav>

      <nav className="p-nav" aria-hidden="true">
        <div className="p-brand-block">
          <span className="p-brand">
            <span className="p-brand-logo">Merry</span>
            <span className="p-brand-sub">Espace prestataire</span>
          </span>
          <span className="p-brand-vendor">
            <Bar w={118} />
          </span>
        </div>
        <div className="p-nav-main">
          {nav.map((n) => (
            <span key={n.href} className="d-nav-item">
              <ProIcon name={n.icon} size={18} />
              {n.label}
            </span>
          ))}
        </div>
        <div className="p-nav-bottom">
          <span className="p-credits-pill">
            <Bar w={74} />
          </span>
          <div className="d-help">
            <span className="d-help-btn">
              <Icon name="settings" size={16} sw={2} />
              <span>Réglages</span>
            </span>
            <span className="d-help-btn">
              <Icon name="bubble" size={16} sw={2} />
              <span>Aide</span>
            </span>
          </div>
        </div>
      </nav>

      <main className="p-main">
        <div className="p-wrap" role="status" aria-label="Chargement">
          <Bar w={220} h={34} r={10} />
          <div className="p-sk-grid">
            <div className="p-sk-col">
              <Card>
                <Bar w="46%" h={24} r={8} />
                <Bar w="100%" h={72} r={16} />
                <Bar w="100%" h={72} r={16} />
              </Card>
              <Card>
                <Bar w="30%" h={20} r={8} />
                <Bar w="100%" h={14} />
                <Bar w="86%" h={14} />
                <Bar w="62%" h={14} />
              </Card>
            </div>
            <div className="p-sk-col">
              <Card>
                <Bar w="48%" h={28} r={8} />
                <Bar w="36%" />
              </Card>
              <Card>
                <Bar w="40%" h={18} r={8} />
                <Bar w="100%" h={14} />
                <Bar w="78%" h={14} />
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
