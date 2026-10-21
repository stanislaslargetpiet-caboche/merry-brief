import "./dashboard.css";
import Shell from "@/components/dash/Shell";

export const metadata = {
  title: "Merry · Tableau de bord",
  description: "Invités, rétroplanning et budget de votre mariage, au même endroit.",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }) {
  return <Shell>{children}</Shell>;
}
