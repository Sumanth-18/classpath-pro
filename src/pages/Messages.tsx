import { useAuth } from "@/contexts/AuthContext";
import ParentMessages from "@/pages/ParentMessages";
import TeacherMessages from "@/pages/TeacherMessages";

export default function Messages() {
  const { role } = useAuth();
  if (role === "parent") return <ParentMessages />;
  return <TeacherMessages />;
}
