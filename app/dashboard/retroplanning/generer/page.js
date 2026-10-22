"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { longDate } from "@/lib/dash/format";
import { signedVendorChoices } from "@/lib/dash/links";
import { GUEST_COUNTS, LIST_STATES, MOMENT_CHOICES, VENDOR_CHOICES, buildTasks, countTasks, defaultAnswers, missingEvents } from "@/lib/dash/retro";
import { Icon, Tile } from "@/components/dash/icons";
import { Btn, PageHeader } from "@/components/dash/ui";

// `known` : réponse déjà donnée dans le brief ; on la rappelle au lieu de reposer la question
function Question({ n, title, hint, known, children }) {
  const [open, setOpen] = useState(!known);
  if (!open) {
    return (
      <section className="d-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span className="d-step-num">{n}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <h2>{title}</h2>
            <span className="d-small d-muted">
              Déjà indiqué dans votre brief : <strong style={{ color: "var(--d-ink)" }}>{known}</strong>
            </span>
          </div>
          <button type="button" className="d-link" onClick={() => setOpen(true)}>
            Modifier
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="d-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span className="d-step-num">{n}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h2>{title}</h2>
          <span className="d-small d-muted">{hint}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function GenererRetroplanning() {
  const dash = useDash();
  const router = useRouter();
  const data = dash.data;
  const [a, setA] = useState(() => defaultAnswers(data));
  const [busy, setBusy] = useState(false);

  const toggle = (key, id) =>
    setA((x) => {
      const on = x[key].includes(id);
      return { ...x, [key]: on ? x[key].filter((v) => v !== id) : [...x[key], id] };
    });

  const count = useMemo(() => countTasks(a, data), [a, data]);
  const date = data.wedding?.wedding_date;
  const noVendor = a.vendors.length === 0;
  const nSigned = signedVendorChoices(data).length;
  const briefGuests = GUEST_COUNTS.find((g) => g.id === data.brief?.guests && g.id !== "inconnu")?.label.toLowerCase();

  async function generate() {
    if (busy) return;
    setBusy(true);
    const events = missingEvents(a, data);
    if (events.length) {
      const created = await dash.insert("events", events);
      // Les invités déjà dans la liste ont une réponse « Invité » à chaque nouveau moment
      const now = new Date().toISOString();
      if (data.guests.length) await dash.insert("guest_responses", created.flatMap((ev) => data.guests.map((g) => ({ guest_id: g.id, event_id: ev.id, status: "attente", updated_at: now }))));
    }
    const tasks = buildTasks(a, data);
    if (tasks.length) await dash.insert("tasks", tasks);
    router.push("/dashboard/retroplanning");
  }

  return (
    <>
      <PageHeader back={{ href: "/dashboard", label: "Accueil" }} title="Votre rétroplanning." actions={null} />
      <p className="d-lead">Quatre questions pour que Merry ne vous propose que ce qui reste à faire.</p>

      <div className="d-col" style={{ gap: 20, maxWidth: 880 }}>
        <Question n={1} title="Quels prestataires avez-vous déjà réservés ?" hint={`Merry saute leurs recherches et ne garde que les derniers points à confirmer avec eux.${nSigned ? " Ceux de vos devis signés sont déjà cochés." : ""}`}>
          <div className="d-chip-row">
            {VENDOR_CHOICES.map((v) => (
              <button key={v.id} type="button" className={`d-pill d-pill-lg${a.vendors.includes(v.id) ? " is-on" : ""}`} aria-pressed={a.vendors.includes(v.id)} onClick={() => toggle("vendors", v.id)}>
                <Tile name={v.icon} size={24} bg="#ffffff" />
                {v.label}
              </button>
            ))}
            <button type="button" className={`d-pill d-pill-lg${noVendor ? " is-on" : ""}`} aria-pressed={noVendor} onClick={() => setA((x) => ({ ...x, vendors: [] }))}>
              Aucun pour l'instant
            </button>
          </div>
        </Question>

        <Question n={2} title="Combien d'invités environ ?" hint="Au-delà de 150, Merry ajoute le transport des invités." known={briefGuests}>
          <div className="d-chip-row">
            {GUEST_COUNTS.map((g) => (
              <button key={g.id} type="button" className={`d-pill d-pill-lg${a.guests === g.id ? " is-on" : ""}`} aria-pressed={a.guests === g.id} onClick={() => setA((x) => ({ ...x, guests: g.id }))}>
                {a.guests === g.id ? <Icon name="check" size={14} sw={2.4} /> : null}
                {g.label}
              </button>
            ))}
          </div>
        </Question>

        <Question n={3} title="Avez-vous déjà une liste d'invités ?" hint="Selon votre réponse, Merry place la collecte des adresses et l'envoi des faire-part au bon moment.">
          <div className="d-chip-row">
            {LIST_STATES.map((s) => (
              <button key={s.id} type="button" className={`d-pill d-pill-lg${a.list === s.id ? " is-on" : ""}`} aria-pressed={a.list === s.id} onClick={() => setA((x) => ({ ...x, list: s.id }))}>
                {a.list === s.id ? <Icon name="check" size={14} sw={2.4} /> : null}
                {s.label}
              </button>
            ))}
            <Link href="/dashboard/invites/importer" className="d-link" style={{ alignSelf: "center" }}>
              Importer ma liste maintenant
            </Link>
          </div>
        </Question>

        <Question n={4} title="Quels moments prévoyez-vous ?" hint="Chacun a ses tâches (dossier de mairie, menu du brunch…) et devient une colonne de réponses dans vos invités.">
          <div className="d-chip-row">
            {MOMENT_CHOICES.map((m) => (
              <button key={m.id} type="button" className={`d-pill d-pill-lg${a.moments.includes(m.id) ? " is-on" : ""}`} aria-pressed={a.moments.includes(m.id)} onClick={() => toggle("moments", m.id)}>
                {a.moments.includes(m.id) ? <Icon name="check" size={14} sw={2.4} /> : null}
                {m.label}
              </button>
            ))}
          </div>
        </Question>

        <div className="d-generate-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <span className="d-generate-icon">
              <Icon name="sparkle" size={22} sw={1.8} />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <strong>
                Merry va créer {count} tâche{count > 1 ? "s" : ""} {date ? `d'ici au ${longDate(date).replace(/^\S+\s/, "")}` : "avant le grand jour"}
              </strong>
              <span className="d-small d-muted">Vous pourrez tout modifier ensuite.</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/dashboard" className="d-link">
              Plus tard
            </Link>
            <Btn icon="sparkle" onClick={generate} disabled={busy}>
              {busy ? "Création…" : "Générer mon rétroplanning"}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}
