import { brandIcon } from "@/lib/brand-icon";

// Site vitrine : le M sur pistache comme le reste du site (D-235), l'appli garde le citron (app/icon.js)
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return brandIcon(64, 14, "#BFE9A6");
}
