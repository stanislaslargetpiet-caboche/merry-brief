// Lecture du site de mariage public côté serveur (aperçu de lien : titre, description)
// par l'API REST de Supabase, avec la même clé publique que le navigateur.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function fetchPublicSite(slug) {
  if (!url || !key || !/^[a-z0-9-]{6,80}$/.test(String(slug || ""))) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/merry_site_public`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ site_slug: slug }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) || null;
  } catch {
    return null;
  }
}
