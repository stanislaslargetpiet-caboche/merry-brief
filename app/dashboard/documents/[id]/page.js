"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { fileSize, findFolder, folderDocs, sortRecent, totalBytes } from "@/lib/dash/documents";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, PageHeader } from "@/components/dash/ui";
import { DocumentRow, DropZone, FolderModal } from "@/components/dash/Documents";

export default function Dossier() {
  const { id } = useParams();
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { documents, members } = data;
  const folder = findFolder(data, id);
  const [renaming, setRenaming] = useState(false);

  const docs = useMemo(() => (folder ? sortRecent(folderDocs(documents, folder.id)) : []), [documents, folder]);

  if (!folder) {
    return (
      <>
        <PageHeader back={{ href: "/dashboard/documents", label: "Documents" }} title="Dossier introuvable." />
        <div className="d-empty">
          <p>Ce dossier n'existe plus ou a été supprimé par un autre organisateur.</p>
        </div>
      </>
    );
  }

  const p = pastel(folder.color);
  const linked = docs.filter((d) => d.vendor_id || d.budget_item_id);

  const destroy = async () => {
    const n = docs.length;
    if (!window.confirm(n ? `Supprimer le dossier « ${folder.name} » et ses ${n} document${n > 1 ? "s" : ""} ?` : `Supprimer le dossier « ${folder.name} » ?`)) return;
    await dash.removeFolder(folder.id);
    dash.setToast({ kind: "ok", text: "Dossier supprimé." });
    router.replace("/dashboard/documents");
  };

  return (
    <>
      <PageHeader
        back={{ href: "/dashboard/documents", label: "Documents" }}
        title={
          <span className="d-folder-head">
            <span className="d-tile" style={{ width: 52, height: 52, borderRadius: 16, background: p.bg }}>
              <Icon name="folder" size={26} stroke={p.ink} sw={1.7} />
            </span>
            <span>
              {folder.name}.
              <span className="d-folder-meta">
                {docs.length} document{docs.length > 1 ? "s" : ""}
                {docs.length ? ` · ${fileSize(totalBytes(docs))}` : ""} · visibles par les {members.length} organisateur{members.length > 1 ? "s" : ""}
              </span>
            </span>
          </span>
        }
        actions={
          !folder.virtual ? (
            <>
              <Btn kind="ghost" icon="pencil" onClick={() => setRenaming(true)}>
                Renommer
              </Btn>
              <Btn kind="ghost" icon="trash" onClick={destroy} title="Supprimer le dossier">
                Supprimer
              </Btn>
            </>
          ) : null
        }
      />

      <div className="d-grid-side">
        <div className="d-col" style={{ gap: 18 }}>
          <DropZone folderId={folder.virtual ? null : folder.id} />
          {docs.length ? (
            <div className="d-docs-list">
              <div className="d-docrow is-head" aria-hidden="true">
                <span className="d-docrow-main">Document</span>
                <span className="d-docrow-by">Ajouté par</span>
                <span className="d-docrow-date">Date</span>
                <span className="d-docrow-size">Taille</span>
                <span />
              </div>
              {docs.map((d) => (
                <DocumentRow key={d.id} doc={d} />
              ))}
            </div>
          ) : (
            <div className="d-empty">
              <p>Rien dans ce dossier pour l'instant. Déposez un premier fichier ci-dessus.</p>
            </div>
          )}
        </div>

        <div className="d-col">
          <section className="d-card">
            <h2>Qui voit ce dossier</h2>
            <div className="d-col" style={{ gap: 10 }}>
              {members.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <Avatar member={m} size={28} />
                  <span style={{ flex: 1 }}>{m.display_name}</span>
                  <span className="d-small d-muted">{m.user_id ? "Organisateur" : "Invité, pas encore connecté"}</span>
                </div>
              ))}
            </div>
            <span className="d-small d-muted" style={{ lineHeight: 1.5 }}>
              Tous les organisateurs peuvent ajouter, renommer et supprimer des documents ici.
            </span>
          </section>
          <section className="d-card is-panel">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="d-tile" style={{ width: 32, height: 32, borderRadius: 999, background: "var(--d-lime)" }}>
                <Icon name="wallet" size={16} sw={2} />
              </span>
              <h2 style={{ margin: 0, fontSize: 15 }}>Relié au budget</h2>
            </div>
            <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
              {linked.length
                ? `${linked.length} document${linked.length > 1 ? "s" : ""} de ce dossier ${linked.length > 1 ? "sont rattachés" : "est rattaché"} à un prestataire : leur montant et leurs échéances sont dans le budget.`
                : "Un devis ou une facture ajouté depuis le budget ou la fiche d'un prestataire se retrouve aussi ici, rattaché à ce prestataire."}
            </span>
            <Link href="/dashboard/budget" className="d-link" style={{ alignSelf: "flex-start" }}>
              Voir le budget
            </Link>
          </section>
        </div>
      </div>

      {renaming ? <FolderModal folder={folder} onClose={() => setRenaming(false)} /> : null}
    </>
  );
}
