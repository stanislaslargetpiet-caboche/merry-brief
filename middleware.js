import { NextResponse } from "next/server";
import { VITRINE_HOSTS, VITRINE_PAGES } from "@/lib/vitrine/routes";

// withmerry.com et www servent le site vitrine (pages /vitrine/* de cette appli) et les pages SEO
// (/mariage/*) ; l'appli reste sur app.withmerry.com. Les pages réservées à l'appli renvoient vers
// app.withmerry.com, et les pages SEO demandées sur app.withmerry.com vers www.withmerry.com.
const APP_ONLY = /^\/(dashboard|pro|connexion|s|f|api)(\/|$)/;
const SEO_ONLY = /^\/(mariage(\/|$)|sitemap\.xml$)/;
const VITRINE_PATHS = Object.fromEntries(Object.entries(VITRINE_PAGES).map(([path, page]) => [page.replace(/\/$/, ""), path]));

export function middleware(req) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = req.nextUrl;
  // Les pages internes /vitrine/* n'ont qu'une adresse publique : celle du site (/, /partenaires…)
  const publicPath = VITRINE_PATHS[pathname.replace(/\/$/, "")];
  if (publicPath && (host === "app.withmerry.com" || VITRINE_HOSTS.includes(host))) {
    return NextResponse.redirect(`https://www.withmerry.com${publicPath}${search}`, 308);
  }
  if (host === "app.withmerry.com" && SEO_ONLY.test(pathname)) {
    return NextResponse.redirect(`https://www.withmerry.com${pathname}${search}`, 308);
  }
  if (!VITRINE_HOSTS.includes(host)) return NextResponse.next();
  if (pathname === "/home") return NextResponse.redirect(new URL(`/${search}`, req.url), 308);
  const target = VITRINE_PAGES[pathname];
  if (target) return NextResponse.rewrite(new URL(`${target}${search}`, req.url));
  if (APP_ONLY.test(pathname)) return NextResponse.redirect(`https://app.withmerry.com${pathname}${search}`, 308);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|apple-icon|.*\\.[a-zA-Z0-9]+$).*)", "/sitemap.xml"],
};
