import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/pages/AdminDashboard";
import ParentDashboard from "@/pages/ParentDashboard";

export default function DashboardRouter() {
  const { role } = useAuth();
  if (role === "parent") return <ParentDashboard />;
  return <AdminDashboard />;
}
