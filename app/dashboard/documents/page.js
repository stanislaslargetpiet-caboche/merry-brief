"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDash } from "@/lib/dash/store";
import { allFolders, fileSize, findFolder, folderDocs, sortRecent, totalBytes } from "@/lib/dash/documents";
import { normalize } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Btn, PageHeader, Section } from "@/components/dash/ui";
import { DocumentRow, DropZone, FolderCard, FolderModal } from "@/components/dash/Documents";

export default function Documents() {
  const dash = useDash();
  const data = dash.data;
  const router = useRouter();
  const { documents, members, meId, documentsSetup } = data;
  const [creating, setCreating] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);

  const folders = useMemo(() => allFolders(data), [data]);

  const q = normalize(query.trim());
  const searching = q.length > 0 || mine;
  const found = useMemo(() => {
    if (!searching) return [];
    return sortRecent(documents.filter((d) => (!mine || d.added_by === meId) && (!q || normalize(d.name).includes(q))));
  }, [documents, searching, mine, meId, q]);
  const recent = useMemo(() => sortRecent(documents).slice(0, 6), [documents]);
  const folderName = (d) => findFolder(data, d.folder_id || "budget")?.name;

  return (
    <>
      <PageHeader
        title="Documents."
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

      <div className="d-card is-panel d-filterbar" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "18px 24px" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{documents.length}</strong>
          <span className="d-small d-muted">
            document{documents.length > 1 ? "s" : ""} dans {folders.length} dossier{folders.length > 1 ? "s" : ""}
            {documents.length ? ` · ${fileSize(totalBytes(documents))}` : ""}
          </span>
        </span>
        <label className="d-search" style={{ flex: "1 1 220px", minHeight: 40 }}>
          <Icon name="search" size={15} sw={2} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un devis, une facture, un contrat…" style={{ width: "100%" }} aria-label="Rechercher un document" />
        </label>
        <div className="d-filters" style={{ marginLeft: "auto" }}>
          <button type="button" className={`d-pill${!mine ? " is-on" : ""}`} onClick={() => setMine(false)}>
            Tout
          </button>
          <button type="button" className={`d-pill${mine ? " is-on" : ""}`} onClick={() => setMine((x) => !x)}>
            Ajoutés par moi
          </button>
        </div>
      </div>

      {dropping ? (
        <div className="d-col" style={{ gap: 10 }}>
          <DropZone folderId={null} onDone={() => setDropping(false)} />
          <span className="d-small d-muted">Un document déposé ici va dans « Devis et factures du budget » ; vous pourrez le déplacer vers un dossier ensuite.</span>
        </div>
      ) : null}

      {searching ? (
        <div className="d-col" style={{ gap: 12 }}>
          <Section title={q ? `Résultats pour « ${query.trim()} »` : "Ajoutés par moi"} count={found.length} />
          {found.length ? (
            <div className="d-docs-list">
              {found.map((d) => (
                <DocumentRow key={d.id} doc={d} showFolder folderName={folderName(d)} />
              ))}
            </div>
          ) : (
            <div className="d-empty">
              <p>Aucun document ne correspond.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="d-col" style={{ gap: 12 }}>
            <Section title="Dossiers" count={folders.length} />
            <div className="d-g3 d-folders">
              {folders.map((f) => (
                <FolderCard key={f.id} folder={f} docs={folderDocs(documents, f.id)} members={members} />
              ))}
              <button type="button" className="d-folder is-new" onClick={() => setCreating(true)}>
                <span className="d-team-plus" style={{ width: 44, height: 44 }}>
                  <Icon name="plus" size={18} sw={2} />
                </span>
                <strong>Créer un dossier</strong>
                <span className="d-small d-muted">Factures et devis, mairie, cérémonie, voyage de noces…</span>
              </button>
            </div>
          </div>

          {recent.length ? (
            <div className="d-col" style={{ gap: 12 }}>
              <Section title="Ajoutés récemment" />
              <div className="d-docs-list">
                {recent.map((d) => (
                  <DocumentRow key={d.id} doc={d} showFolder folderName={folderName(d)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {creating ? <FolderModal onClose={() => setCreating(false)} onCreated={(f) => router.push(`/dashboard/documents/${f.id}`)} /> : null}
    </>
  );
}
