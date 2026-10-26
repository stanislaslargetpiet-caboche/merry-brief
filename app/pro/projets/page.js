"use client";

// Projets de mariage (maquettes V7, V7b et V7m) : des couples de la région qui acceptent d'être contactés.
// Prénoms et message masqués ; un déblocage (en crédits) les montre et permet d'envoyer une proposition.
// La liste reste vide tant que les couples n'ont pas d'écran pour donner leur accord (à dessiner).

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePro } from "@/lib/pro/store";
import { Popover } from "@/components/dash/ui";
import { toDate } from "@/lib/dash/format";
import { budgetRange, dateLong } from "@/lib/pro/format";
import { ProIcon } from "@/components/pro/icons";
import { Sheet } from "@/components/pro/ui";
import { CloseBtn } from "@/components/pro/FeatureDialog";

const GUESTS = { "<50": 40, "50-100": 80, "100-150": 120, "150-200": 170, ">200": 220 };
const FORMAT = { weekend: "Un week-end, du samedi au dimanche", jour: "Sur une journée" };
const SEASONS = [
  { key: "", label: "Toutes les dates" },
  { key: "3-5", label: "Avril à juin" },
  { key: "5-8", label: "Juin à septembre" },
  { key: "8-10", label: "Septembre à novembre" },
  { key: "10-2", label: "Novembre à mars" },
];
const SIZES = [
  { key: "", label: "Tous les invités" },
  { key: "0-80", label: "Moins de 80 invités" },
  { key: "80-160", label: "80 à 160 invités" },
  { key: "160-999", label: "Plus de 160 invités" },
];
const BUDGETS = [
  { key: "", label: "Budget" },
  { key: "<15k", label: "Moins de 15 000 €" },
  { key: "15-30k", label: "15 000 à 30 000 €" },
  { key: "30-50k", label: "30 000 à 50 000 €" },
  { key: ">50k", label: "Plus de 50 000 €" },
];
const DISTANCES = [
  { key: "", label: "Toutes distances" },
  { key: "30", label: "Moins de 30 km" },
  { key: "60", label: "Moins de 60 km" },
];

const guestsOf = (p) => p.guestsCount || GUESTS[p.guests] || null;
const monthOf = (p) => (p.wedding_date ? toDate(p.wedding_date).getMonth() : null);

export default function Projets() {
  const pro = usePro();
  const router = useRouter();
  const d = pro.data;
  const cost = d.offer?.unlock_cost;
  const [f, setF] = useState({ season: "", size: "", budget: "", km: "" });
  const [unlocking, setUnlocking] = useState(null);
  const [writing, setWriting] = useState(null);

  const list = (d.projects || []).filter((p) => {
    if (f.km && p.km > Number(f.km)) return false;
    if (f.budget && p.budget !== f.budget) return false;
    if (f.size) {
      const [a, b] = f.size.split("-").map(Number);
      const g = guestsOf(p);
      if (g !== null && (g < a || g > b)) return false;
    }
    if (f.season) {
      const [a, b] = f.season.split("-").map(Number);
      const m = monthOf(p);
      if (m !== null && !(a <= b ? m >= a && m <= b : m >= a || m <= b)) return false;
    }
    return true;
  });

  return (
    <div className="p-projets">
      <div className="p-head-text is-8">
        <h1 className="p-h1 is-page">Projets de mariage.</h1>
        <p className="p-projets-lead">Des couples de votre région cherchent encore. Présentez-vous.</p>
        <p className="p-note is-135">Ces couples ont accepté d’être contactés par des prestataires.</p>
      </div>
      <div role="group" aria-label="Filtres" className="p-filters">
        <Filter options={SEASONS} value={f.season} onChange={(season) => setF((x) => ({ ...x, season }))} />
        <Filter options={SIZES} value={f.size} onChange={(size) => setF((x) => ({ ...x, size }))} />
        <Filter options={BUDGETS} value={f.budget} onChange={(budget) => setF((x) => ({ ...x, budget }))} />
        <Filter options={DISTANCES} value={f.km} onChange={(km) => setF((x) => ({ ...x, km }))} />
      </div>
      {list.length ? (
        <ul className="p-projects">
          {list.map((p) =>
            p.unlocked ? (
              <Unlocked key={p.wedding_id} p={p} writing={writing === p.wedding_id} onWrite={() => setWriting(p.wedding_id)} onCancel={() => setWriting(null)} onSent={() => router.push("/pro/clients")} />
            ) : (
              <li key={p.wedding_id} className="p-project">
                <div className="p-project-top">
                  <span className="p-project-title">Couple · {p.area || "Votre région"}</span>
                  <span className="p-masked">
                    <ProIcon name="lock" size={14} stroke="#6b6a63" />
                    Prénoms masqués
                  </span>
                </div>
                <Facts p={p} />
                <Tags p={p} />
                <div className="p-blurred">
                  <p aria-hidden="true">{p.note || "Le message du couple, ce qu’il cherche et ce qui compte pour lui, en quelques phrases."}</p>
                  <span>Message visible après déblocage</span>
                </div>
                <div className="p-project-foot">
                  <button type="button" className="p-btn p-btn-ghost" onClick={() => setUnlocking(p)}>
                    Débloquer ce projet
                  </button>
                  <span className="p-cost">
                    <ProIcon name="credits" size={14} stroke="#6b6a63" />
                    {cost === null || cost === undefined ? "Crédits à définir" : `${cost} crédit${cost > 1 ? "s" : ""}`}
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <div className="p-empty-card">
          <p>{(d.projects || []).length ? "Aucun projet avec ces filtres." : "Aucun projet ouvert près de chez vous pour l’instant. Les couples qui acceptent d’être contactés par des prestataires apparaîtront ici."}</p>
        </div>
      )}
      {unlocking ? <UnlockDialog p={unlocking} onClose={() => setUnlocking(null)} /> : null}
    </div>
  );
}

function Filter({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.key === value) || options[0];
  return (
    <span className="d-anchor">
      <button type="button" aria-haspopup="true" aria-expanded={open} className={`p-filter${value ? " is-on" : ""}`} onClick={() => setOpen((o) => !o)}>
        {cur.label}
        <ProIcon name="chevDown" size={15} sw={2} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`d-pop-item${o.key === value ? " is-on" : ""}`}
            onClick={() => {
              onChange(o.key);
              setOpen(false);
            }}
          >
            {o.label}
          </button>
        ))}
      </Popover>
    </span>
  );
}

function when(p) {
  if (p.wedding_date) return dateLong(p.wedding_date);
  return p.dateLabel || "À définir";
}

function Facts({ p }) {
  const g = guestsOf(p);
  return (
    <div className="p-facts2 is-tight">
      <div className="p-fact">
        <span>Date</span>
        <strong>{when(p)}</strong>
      </div>
      <div className="p-fact">
        <span>Invités</span>
        <strong>{g || "À définir"}</strong>
      </div>
      <div className="p-fact">
        <span>Budget</span>
        <strong>{p.budgetLabel || budgetRange(p.budget) || "Non précisé"}</strong>
      </div>
      <div className="p-fact">
        <span>Distance</span>
        <strong>{p.km !== null && p.km !== undefined ? `${p.km} km` : "–"}</strong>
      </div>
    </div>
  );
}

function Tags({ p }) {
  const tags = (p.vibes || []).filter((x) => x && !/sait pas/i.test(x));
  if (!tags.length) return null;
  return (
    <div className="p-tags">
      {tags.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}

function Unlocked({ p, writing, onWrite, onCancel, onSent }) {
  const pro = usePro();
  const [text, setText] = useState(`Bonjour ${(p.names || "").replace(" & ", " et ")}, `);
  const [busy, setBusy] = useState(false);
  const brief = p.brief || [FORMAT[p.format]].filter(Boolean);
  async function send() {
    setBusy(true);
    const ok = await pro.proposeProject(p.wedding_id, text.trim());
    setBusy(false);
    if (ok) {
      pro.setToast({ kind: "ok", text: `Proposition envoyée à ${p.names}. Vous les retrouvez dans Clients.` });
      onSent();
    }
  }
  return (
    <li className="p-project is-open">
      <div className="p-project-top is-wrap">
        <div className="p-who is-2">
          <span className="p-project-names">{p.names}</span>
          <span className="p-project-where">
            {p.area}
            {p.km !== null && p.km !== undefined ? ` · À ${p.km} km` : ""}
          </span>
        </div>
        <span className="p-chip is-planned">{p.proposed ? "Proposition envoyée" : "Projet débloqué"}</span>
      </div>
      <div className="p-project-cols">
        <div className="p-project-col">
          <Facts p={p} />
          <Tags p={p} />
          {brief.length ? (
            <div className="p-dem-block">
              <span className="p-dem-label">Leur brief</span>
              <ul className="p-bullets">
                {brief.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {p.note ? (
          <div className="p-dem-block">
            <span className="p-dem-label">Leur message</span>
            <p className="p-bubble is-14">{p.note}</p>
          </div>
        ) : null}
      </div>
      {writing ? (
        <div className="p-dem-block">
          <label htmlFor={`prop-${p.wedding_id}`} className="p-dem-label">
            Votre proposition
          </label>
          <textarea id={`prop-${p.wedding_id}`} rows={4} className="p-textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <div className="p-edit-actions">
            <span />
            <span>
              <button type="button" className="p-btn p-btn-ghost is-40" onClick={onCancel}>
                Annuler
              </button>
              <button type="button" className="p-btn p-btn-primary is-40" onClick={send} disabled={busy || text.trim().length < 10}>
                Envoyer
              </button>
            </span>
          </div>
        </div>
      ) : p.proposed ? null : (
        <div className="p-project-send">
          <button type="button" className="p-btn p-btn-primary" onClick={onWrite}>
            Envoyer une proposition
          </button>
        </div>
      )}
    </li>
  );
}

function UnlockDialog({ p, onClose }) {
  const pro = usePro();
  const cost = pro.data.offer?.unlock_cost;
  const balance = pro.data.pro?.credits ?? 0;
  const priced = cost !== null && cost !== undefined;
  const enough = priced && balance >= cost;
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    const res = await pro.unlockProject(p.wedding_id);
    setBusy(false);
    if (res.ok) onClose();
    else pro.setToast({ kind: "error", text: res.reason === "credits" ? "Il vous manque des crédits pour débloquer ce projet." : "Le projet n’a pas pu être débloqué. Réessayez." });
  }
  const g = guestsOf(p);
  return (
    <Sheet labelledBy="deb-titre" onClose={onClose} className="p-unlock">
      <div className="p-sheet-head is-center">
        <h2 id="deb-titre">Débloquer ce projet</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <p className="p-unlock-text">Vous verrez les prénoms du couple, leur brief complet et leur message, et pourrez leur envoyer une proposition.</p>
      <div className="p-unlock-sum">
        <span>Couple · {p.area || "Votre région"}</span>
        <span>{[when(p), g ? `${g} invités` : null, p.budgetLabel || budgetRange(p.budget)].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="p-unlock-rows">
        <div>
          <span>Solde actuel</span>
          <span className="p-unlock-now">
            {balance} crédit{balance > 1 ? "s" : ""}
          </span>
        </div>
        <div>
          <span className="p-ink">Solde après déblocage</span>
          <span className="p-unlock-after">{priced ? `${balance - cost} crédit${Math.abs(balance - cost) > 1 ? "s" : ""}` : "À définir"}</span>
        </div>
      </div>
      {!priced ? <p className="p-claim-help is-small">Le nombre de crédits d’un déblocage reste à fixer par Merry.</p> : null}
      {priced && !enough ? (
        <p className="p-claim-help is-small">
          Il vous manque {cost - balance} crédit{cost - balance > 1 ? "s" : ""}. <Link href="/pro/credits">Acheter des crédits</Link>
        </p>
      ) : null}
      <div className="p-unlock-foot">
        <button type="button" className="p-day-cancel" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="p-btn p-btn-primary is-big" onClick={confirm} disabled={busy || !enough}>
          Confirmer
        </button>
      </div>
    </Sheet>
  );
}

