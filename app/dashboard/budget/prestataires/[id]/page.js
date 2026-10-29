"use client";

import { useParams } from "next/navigation";
import { useDash } from "@/lib/dash/store";
import { itemFinance } from "@/lib/dash/model";
import { euros, initials } from "@/lib/dash/format";
import { Icon, Tile, guessIcon } from "@/components/dash/icons";
import { Btn, InlineEdit, OkPill, PageHeader } from "@/components/dash/ui";
import { AiFillButton, VendorDocuments } from "@/components/dash/VendorTools";

function telHref(phone) {
  return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}

function siteHref(site) {
  if (!site) return null;
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

// Fiche d'un prestataire réservé (artboard 2g) : ses coordonnées et ses documents, rien d'autre
export default function Prestataire() {
  const { id } = useParams();
  const dash = useDash();
  const { vendors, items, payments, documents } = dash.data;
  const vendor = vendors.find((v) => v.id === id);

  if (!vendor) return <PageHeader back={{ href: "/dashboard/budget", label: "Budget" }} title="Prestataire introuvable." />;

  const item = items.find((i) => i.vendor_id === vendor.id);
  const f = item ? itemFinance(item, payments) : null;
  const docs = documents.filter((d) => d.vendor_id === vendor.id || (item && d.budget_item_id === item.id));

  return (
    <>
      <PageHeader back={{ href: "/dashboard/budget", label: "Budget" }} />
      <div className="d-vendor-head" style={{ marginTop: -14 }}>
        <div className="d-vendor-id">
          <Tile name={item?.icon || guessIcon(vendor.category || vendor.name)} size={60} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <h1 className="d-title">{vendor.name}.</h1>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14, color: "var(--d-muted)" }}>
              <InlineEdit value={vendor.category} placeholder="Catégorie" label="catégorie" width={140} onSave={(v) => dash.update("vendors", vendor.id, { category: v })} />
              {f?.quote !== null && f?.quote !== undefined ? <span>· devis signé de {euros(f.quote)}</span> : null}
              {f?.quote !== null && f?.quote !== undefined ? <OkPill small>Réservé</OkPill> : null}
            </span>
          </div>
        </div>
        {vendor.phone ? (
          <>
            <div className="d-header-actions">
              <Btn kind="strong" icon="phone" href={telHref(vendor.phone)}>
                Appeler
              </Btn>
            </div>
            <div className="d-mob-only">
              <div className="d-vendor-actions-m">
                <Btn kind="strong" icon="phone" href={telHref(vendor.phone)} small>
                  Appeler
                </Btn>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="d-g2">
          <section className="d-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <h2>Contact</h2>
              <AiFillButton vendor={vendor} item={item} docs={docs} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="d-avatar" style={{ width: 40, height: 40, background: "#e4e2dc", fontSize: 14 }}>
                {initials(vendor.contact_name || vendor.name)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <InlineEdit value={vendor.contact_name} placeholder="Nom de votre interlocuteur" label="interlocuteur" onSave={(v) => dash.update("vendors", vendor.id, { contact_name: v })} />
                <span className="d-small d-muted">
                  <InlineEdit value={vendor.contact_role} placeholder="Son rôle" label="rôle" onSave={(v) => dash.update("vendors", vendor.id, { contact_role: v })} />
                </span>
              </div>
            </div>
            <div>
              {[
                ["phone", "Téléphone", "phone"],
                ["email", "Mail", "mail"],
                ["website", "Site", "globe"],
                ["iban", "IBAN", "bank"],
              ].map(([k, label, icon]) => (
                <div key={k} className="d-contact-row">
                  <Icon name={icon} size={16} style={{ marginTop: 3 }} />
                  <div>
                    <small>{label}</small>
                    <InlineEdit value={vendor[k]} placeholder="Ajouter" label={label.toLowerCase()} onSave={(v) => dash.update("vendors", vendor.id, { [k]: v })} />
                    {k === "website" && vendor.website ? (
                      <a href={siteHref(vendor.website)} target="_blank" rel="noreferrer" className="d-small">
                        Ouvrir le site
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <VendorDocuments vendor={vendor} item={item} docs={docs} />
      </div>
    </>
  );
}
