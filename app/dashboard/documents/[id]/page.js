"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { allFolders, findFolder, folderColors, folderDocs, sortRecent } from "@/lib/dash/documents";
import { pastel } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";
import { DocumentRow, DropZone, FolderModal } from "@/components/dash/Documents";

export default function Dossier() {
  const { id } = useParams();
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const { documents } = data;
  const folder = findFolder(data, id);
  const [renaming, setRenaming] = useState(false);
  const [dropping, setDropping] = useState(false);

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

  const tint = folderColors(allFolders(data))[folder.id] || folder.color;
  const p = pastel(tint);

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
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {!folder.virtual ? (
              <>
                <Btn kind="ghost" icon="pencil" onClick={() => setRenaming(true)}>
                  Renommer
                </Btn>
                <Btn kind="ghost" icon="trash" onClick={destroy} title="Supprimer le dossier">
                  Supprimer
                </Btn>
              </>
            ) : null}
            <Btn icon="upload" onClick={() => setDropping((x) => !x)}>
              Ajouter un document
            </Btn>
          </>
        }
      />

      <div className="d-col" style={{ gap: 18 }}>
        {dropping ? <DropZone folderId={folder.virtual ? null : folder.id} folderName={folder.virtual ? null : folder.name} onDone={() => setDropping(false)} /> : null}
        {docs.length ? (
          <>
            <div className="d-docs-list d-desk-only">
              <div className="d-docrow is-head" aria-hidden="true">
                <span className="d-docrow-main">Document</span>
                <span className="d-docrow-by">Ajouté par</span>
                <span className="d-docrow-date">Date</span>
                <span />
              </div>
              {docs.map((d) => (
                <DocumentRow key={d.id} doc={d} tint={tint} />
              ))}
            </div>
            <div className="d-mob-only">
              <div className="d-docs-list">
                {docs.slice(0, 6).map((d) => (
                  <DocumentRow key={d.id} doc={d} compact tint={tint} />
                ))}
              </div>
              {docs.length > 6 ? (
                <p className="d-small d-muted" style={{ textAlign: "center" }}>
                  {docs.length - 6} autre{docs.length - 6 > 1 ? "s" : ""} document{docs.length - 6 > 1 ? "s" : ""} plus ancien{docs.length - 6 > 1 ? "s" : ""}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="d-empty">
            <p>Rien dans ce dossier pour l'instant.</p>
          </div>
        )}
      </div>

      {renaming ? <FolderModal folder={folder} onClose={() => setRenaming(false)} /> : null}
    </>
  );
}
