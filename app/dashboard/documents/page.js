"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/dash/store";
import { allFolders, findFolder, folderColors, folderDocs, sortRecent } from "@/lib/dash/documents";
import { Icon } from "@/components/dash/icons";
import { Btn, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import { DocumentRow, DropZone, FolderCard, FolderModal } from "@/components/dash/Documents";

export default function Documents() {
  const dash = useDash();
  const data = dash.data;
  const router = useRouter();
  const { documents, documentsSetup } = data;
  const [creating, setCreating] = useState(false);
  const [dropping, setDropping] = useState(false);

  const folders = useMemo(() => allFolders(data), [data]);
  const recent = useMemo(() => sortRecent(documents).slice(0, 6), [documents]);
  const folderName = (d) => findFolder(data, d.folder_id || "budget")?.name;

  const colors = folderColors(folders);

  return (
    <>
      <BudgetHeader
        tab="documents"
        actions={
          <>
            <Btn kind="ghost" icon="folderPlus" onClick={() => setCreating(true)}>
              Nouveau dossier
            </Btn>
            <Btn icon="upload" onClick={() => setDropping((x) => !x)}>
              Ajouter un document
            </Btn>
          </>
        }
      />

      {dash.mode === "live" && !documentsSetup ? (
        <div className="d-card is-panel">
          <strong>Le bloc Documents n'est pas encore installé sur la base.</strong>
          <span className="d-small" style={{ lineHeight: 1.5, color: "#43423c" }}>
            Collez le fichier <code>supabase/documents.sql</code> dans Supabase (SQL Editor), puis rechargez la page. Il crée les dossiers et le stockage privé des fichiers.
          </span>
        </div>
      ) : null}

      {dropping ? <DropZone folderId={null} onDone={() => setDropping(false)} /> : null}

      <div className="d-col" style={{ gap: 12 }}>
        <span className="d-desk-only">
          <Section title="Dossiers" count={folders.length} />
        </span>
        <div className="d-g3 d-folders">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} color={colors[f.id]} docs={folderDocs(documents, f.id)} />
          ))}
        </div>
      </div>

      {recent.length ? (
        <div className="d-col d-desk-only" style={{ gap: 12 }}>
          <Section title="Ajoutés récemment" />
          <div className="d-docs-list">
            {recent.map((d) => (
              <DocumentRow key={d.id} doc={d} showFolder folderName={folderName(d)} tint={colors[d.folder_id]} />
            ))}
          </div>
        </div>
      ) : null}

      {!dropping ? (
        <button type="button" className="d-fab" aria-label="Ajouter un document" onClick={() => setDropping(true)}>
          <Icon name="plus" size={22} sw={2.4} />
        </button>
      ) : null}

      {creating ? <FolderModal onClose={() => setCreating(false)} onCreated={(f) => router.push(`/dashboard/documents/${f.id}`)} /> : null}
    </>
  );
}
