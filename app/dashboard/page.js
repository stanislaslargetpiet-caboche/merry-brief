import { redirect } from "next/navigation";

// À la connexion, on arrive toujours sur les invités, première entrée du menu
export default function DashboardIndex() {
  redirect("/dashboard/invites");
}
