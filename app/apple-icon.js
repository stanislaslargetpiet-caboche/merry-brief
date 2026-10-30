import { brandIcon } from "@/lib/brand-icon";

// iOS arrondit lui-même les coins : fond plein, sans rayon
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180, 0);
}
