// Synchronisation en direct entre organisateurs (Supabase Realtime) : les changements faits par un autre
// organisateur sur la liste des invités arrivent dans la page sans recharger, et chacun voit qui est
// sur la liste en même temps que lui (présence). Sans publication Realtime sur les tables
// (supabase/sync-et-historique.sql), rien ne se passe : la page fonctionne comme avant.

const SORTED = { guest_groups: "position", events: "position", guest_fields: "position", guests: "position" };
const KEYS = { guest_groups: "groups", events: "events", guest_fields: "fields", guests: "guests", guest_responses: "responses", guest_response_log: "log" };
export const SYNC_TABLES = Object.keys(KEYS);

const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0);
const sameResp = (a, b) => a.guest_id === b.guest_id && a.event_id === b.event_id;

// Applique un changement reçu (insert / update / delete) aux données du tableau de bord : pur, idempotent
// (nos propres écritures reviennent aussi par ce canal, avec les mêmes valeurs).
export function applyChange(data, table, { eventType, new: row, old }) {
  if (table === "weddings") {
    if (eventType !== "UPDATE" || !row) return data;
    // Seules les parties partagées par ce canal : note et vues (le reste est rarement modifié à deux)
    const patch = {};
    if ("guests_note" in row) patch.guests_note = row.guests_note;
    if ("guest_views" in row) patch.guest_views = row.guest_views;
    return Object.keys(patch).length ? { ...data, wedding: { ...data.wedding, ...patch } } : data;
  }
  const key = KEYS[table];
  if (!key || !data[key]) return data;
  const list = data[key];
  if (table === "guest_responses") {
    if (eventType === "DELETE") {
      const o = old || {};
      if (!o.guest_id) return data;
      return { ...data, responses: list.filter((r) => !sameResp(r, o)) };
    }
    if (!row) return data;
    const i = list.findIndex((r) => sameResp(r, row));
    if (i >= 0 && list[i].status === row.status && list[i].updated_at === row.updated_at) return data;
    const next = i >= 0 ? list.map((r, j) => (j === i ? { ...r, ...row } : r)) : [...list, row];
    return { ...data, responses: next };
  }
  if (eventType === "DELETE") {
    const id = old?.id;
    if (!id || !list.some((x) => x.id === id)) return data;
    const next = { ...data, [key]: list.filter((x) => x.id !== id) };
    if (table === "guests") {
      next.responses = data.responses.filter((r) => r.guest_id !== id);
      next.guests = next.guests.filter((g) => g.plus_one_of !== id);
    }
    if (table === "events") next.responses = data.responses.filter((r) => r.event_id !== id);
    if (table === "guest_groups") next.guests = data.guests.map((g) => (g.group_id === id ? { ...g, group_id: null } : g));
    return next;
  }
  if (!row?.id) return data;
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0 && shallowSame(list[i], row)) return data;
  let next = i >= 0 ? list.map((x, j) => (j === i ? { ...x, ...row } : x)) : [...list, row];
  if (SORTED[table]) next = [...next].sort(byPos);
  return { ...data, [key]: next };
}

function shallowSame(a, b) {
  for (const k of Object.keys(b)) {
    const x = a[k];
    const y = b[k];
    if (x === y) continue;
    if (typeof x === "object" && typeof y === "object" && JSON.stringify(x) === JSON.stringify(y)) continue;
    return false;
  }
  return true;
}

// Ouvre le canal du mariage : changements des tables de la liste, et présence des organisateurs.
// Retourne { track(page), close() }.
export function subscribeWedding(supabase, weddingId, me, { onChange, onPresence }) {
  const channel = supabase.channel(`wedding:${weddingId}`, { config: { presence: { key: me?.id || "anon" } } });
  for (const table of SYNC_TABLES) {
    channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `wedding_id=eq.${weddingId}` }, (payload) => onChange(table, payload));
  }
  channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "weddings", filter: `id=eq.${weddingId}` }, (payload) => onChange("weddings", payload));
  const readPresence = () => {
    const state = channel.presenceState();
    const others = [];
    for (const [key, metas] of Object.entries(state)) {
      if (key === (me?.id || "anon")) continue;
      const m = metas[metas.length - 1];
      if (m) others.push({ member_id: key, ...m });
    }
    onPresence(others);
  };
  channel.on("presence", { event: "sync" }, readPresence);
  let page = typeof window !== "undefined" ? window.location.pathname : "";
  let joined = false;
  const track = () => {
    if (!joined || !me) return;
    channel.track({ name: me.display_name, initial: me.initial, color: me.color, page, at: new Date().toISOString() });
  };
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      joined = true;
      track();
    }
  });
  return {
    track(nextPage) {
      if (nextPage === page) return;
      page = nextPage;
      track();
    },
    close() {
      joined = false;
      supabase.removeChannel(channel);
    },
  };
}
