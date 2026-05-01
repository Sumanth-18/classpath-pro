import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CalendarCheck, Wallet, ClipboardList, BookOpen, Bell, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";

const sb: any = supabase;

interface Stats {
  attendancePct: number | null;
  pendingFee: number;
  pendingHomework: number;
  lastExamPct: number | null;
}

interface Announcement { id: string; title: string; created_at: string; content: string | null }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ParentDashboard() {
  const { profile, school } = useAuth();
  const { activeChild } = useChild();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ attendancePct: null, pendingFee: 0, pendingHomework: 0, lastExamPct: null });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!activeChild?.id || !school?.id) return;
    const childId = activeChild.id;
    const sectionId = activeChild.section_id;
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    (async () => {
      const [{ data: attRows }, { data: dues }, { data: pays }, { data: assignments }, { data: subs }, { data: exams }, { data: ann }] = await Promise.all([
        supabase.from("attendance").select("status").eq("student_id", childId).gte("date", monthStart).lte("date", monthEnd),
        supabase.from("fee_dues").select("amount_due").eq("student_id", childId).eq("is_paid", false),
        sb.from("fee_payments").select("amount_paid").eq("student_id", childId),
        sectionId
          ? supabase.from("assignments").select("id, due_date").eq("section_id", sectionId).eq("school_id", school.id)
          : Promise.resolve({ data: [] as any[] }),
        sb.from("homework_submissions").select("assignment_id, marked_done_by_parent").eq("student_id", childId),
        supabase.from("exams").select("id, name, start_date, published, class_id").eq("school_id", school.id).eq("published", true).order("start_date", { ascending: false }).limit(1),
        supabase.from("announcements").select("id, title, content, created_at").eq("school_id", school.id).eq("is_published", true).order("created_at", { ascending: false }).limit(5),
      ]);

      const total = (attRows ?? []).length;
      const present = (attRows ?? []).filter((r: any) => ["present", "late", "leave_approved"].includes(r.status)).length;
      const attendancePct = total > 0 ? Math.round((present / total) * 100) : null;

      const totalDue = (dues ?? []).reduce((s: number, d: any) => s + Number(d.amount_due), 0);
      const totalPaid = (pays ?? []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
      const pendingFee = Math.max(0, totalDue - totalPaid);

      const doneIds = new Set((subs ?? []).filter((r: any) => r.marked_done_by_parent).map((r: any) => r.assignment_id));
      const pendingHomework = (assignments ?? []).filter((a: any) => !doneIds.has(a.id)).length;

      let lastExamPct: number | null = null;
      const exam = (exams ?? [])[0];
      if (exam) {
        const { data: marks } = await supabase.from("marks").select("marks_obtained, max_marks").eq("student_id", childId).eq("exam_id", exam.id);
        if (marks && marks.length) {
          const obt = marks.reduce((s: number, m: any) => s + Number(m.marks_obtained ?? 0), 0);
          const max = marks.reduce((s: number, m: any) => s + Number(m.max_marks ?? 0), 0);
          lastExamPct = max > 0 ? Math.round((obt / max) * 100) : null;
        }
      }

      setStats({ attendancePct, pendingFee, pendingHomework, lastExamPct });
      setAnnouncements((ann ?? []) as Announcement[]);
    })();
  }, [activeChild?.id, school?.id]);

  if (!activeChild) {
    return <div className="p-12 text-center text-sm text-muted-foreground">No children linked to your account.</div>;
  }

  const cards = [
    { label: "This month attendance", value: stats.attendancePct == null ? "—" : `${stats.attendancePct}%`, icon: CalendarCheck, soft: "bg-success-soft", color: "text-success", to: "/attendance" },
    { label: "Pending fees", value: `₹${stats.pendingFee.toLocaleString("en-IN")}`, icon: Wallet, soft: "bg-warning-soft", color: "text-warning", to: "/fees" },
    { label: "Pending homework", value: stats.pendingHomework, icon: ClipboardList, soft: "bg-info-soft", color: "text-info", to: "/homework" },
    { label: "Last exam average", value: stats.lastExamPct == null ? "—" : `${stats.lastExamPct}%`, icon: BookOpen, soft: "bg-violet-soft", color: "text-violet", to: "/marks" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">
          Hello, {profile?.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Viewing <span className="font-semibold text-foreground">{activeChild.name}</span> · {activeChild.classLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={() => navigate(c.to)} className="card-soft p-4 lg:p-5 text-left hover:shadow-soft hover:-translate-y-0.5 transition">
              <div className="flex items-start justify-between">
                <div className={`stat-icon ${c.soft}`}>
                  <Icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 lg:mt-4">
                <div className="text-2xl lg:text-3xl font-display font-bold">{c.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-display font-semibold">Recent Announcements</h2>
          <button onClick={() => navigate("/announcements")} className="text-xs font-semibold text-primary hover:underline">View all</button>
        </div>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No announcements yet.</p>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl p-3 hover:bg-muted/60 transition">
                <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground line-clamp-1">{a.title}</div>
                  {a.content && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.content}</div>}
                  <div className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
