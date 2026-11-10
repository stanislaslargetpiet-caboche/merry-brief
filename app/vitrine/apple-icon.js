import { brandIcon } from "@/lib/brand-icon";

// iOS arrondit lui-même les coins : fond plein, sans rayon ; pistache comme le site (D-235)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180, 0, "#BFE9A6");
}
