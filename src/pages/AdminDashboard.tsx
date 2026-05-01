import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, GraduationCap, CalendarCheck, Wallet, Bell, ArrowRight,
  ClipboardList, BookOpen, ChevronRight, AlertTriangle, Cake, RefreshCw,
  CheckCircle2, XCircle, MessageSquareWarning,
} from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import toast from "react-hot-toast";

interface Stats {
  totalStudents: number;
  totalStaff: number;
  presentToday: number;
  presentPct: number;
  feePendingK: number;
}

interface Announcement { id: string; title: string; created_at: string }

interface AtRiskRow { id: string; name: string; pct: number; pending: number }
interface DigestData {
  lowAttendance: { id: string; name: string; pct: number }[];
  feeThisMonth: number;
  feeLastMonth: number;
  staleUnread: number;
  sectionsMissingToday: { id: string; label: string }[];
}
interface PendingLeave {
  id: string;
  user_id: string;
  parent_name: string;
  student_name: string;
  student_id: string;
  from_date: string;
  to_date: string;
  reason: string | null;
  leave_type: string | null;
}

const WEEK_DATA = [
  { day: "Mon", present: 92, absent: 8 }, { day: "Tue", present: 88, absent: 12 },
  { day: "Wed", present: 94, absent: 6 }, { day: "Thu", present: 90, absent: 10 },
  { day: "Fri", present: 86, absent: 14 }, { day: "Sat", present: 78, absent: 22 },
];

const QUICK_ACTIONS = [
  { label: "Mark Attendance", icon: CalendarCheck, gradient: "bg-gradient-success", to: "/attendance" },
  { label: "Enter Marks", icon: BookOpen, gradient: "bg-gradient-info", to: "/grades" },
  { label: "Collect Fee", icon: Wallet, gradient: "bg-gradient-warning", to: "/fees" },
  { label: "New Assignment", icon: ClipboardList, gradient: "bg-gradient-violet", to: "/assignments" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Parses parent leave reason "[Student: <uuid>] type: text"
function parseLeaveReason(raw: string | null): { studentId: string | null; clean: string } {
  if (!raw) return { studentId: null, clean: "" };
  const m = raw.match(/^\[Student:\s*([0-9a-fA-F-]+)\]\s*(.*)$/);
  if (!m) return { studentId: null, clean: raw };
  return { studentId: m[1], clean: m[2] };
}

export default function AdminDashboard() {
  const { profile, school, role, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalStaff: 0, presentToday: 0, presentPct: 0, feePendingK: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [classTeacherOf, setClassTeacherOf] = useState<{ name: string; sectionId: string } | null>(null);

  // admin extras
  const [atRisk, setAtRisk] = useState<AtRiskRow[]>([]);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const isMonday = new Date().getDay() === 1;

  // teacher extras
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [birthdays, setBirthdays] = useState<{ id: string; name: string; parent_phone: string | null }[]>([]);
  const [rejectFor, setRejectFor] = useState<PendingLeave | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!school?.id || !profile?.id || role !== "teacher") { setClassTeacherOf(null); return; }
    (async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, name, classes!inner(name)")
        .eq("school_id", school.id)
        .eq("class_teacher_id", profile.id)
        .maybeSingle();
      if (data) setClassTeacherOf({ name: `${(data as any).classes?.name ?? "Class"} ${(data as any).name}`, sectionId: (data as any).id });
      else setClassTeacherOf(null);
    })();
  }, [school?.id, profile?.id, role]);

  useEffect(() => {
    if (!school?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [studentsRes, staffRes, attendanceRes, duesRes, annRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("is_active", true),
        supabase.from("staff_profiles").select("id", { count: "exact", head: true }).eq("school_id", school.id),
        supabase.from("attendance").select("status").eq("school_id", school.id).eq("date", today),
        supabase.from("fee_dues").select("amount_due").eq("school_id", school.id).eq("is_paid", false),
        supabase.from("announcements").select("id, title, created_at").eq("school_id", school.id).eq("is_published", true).order("created_at", { ascending: false }).limit(4),
      ]);
      const totalStudents = studentsRes.count ?? 0;
      const totalStaff = staffRes.count ?? 0;
      const att = attendanceRes.data ?? [];
      const presentToday = att.filter((a) => a.status === "present" || a.status === "late" || a.status === "leave_approved").length;
      const presentPct = att.length > 0 ? Math.round((presentToday / att.length) * 100) : 0;
      const feePendingTotal = (duesRes.data ?? []).reduce((s, d: any) => s + Number(d.amount_due ?? 0), 0);
      setStats({ totalStudents, totalStaff, presentToday, presentPct, feePendingK: Math.round(feePendingTotal / 1000) });
      setAnnouncements((annRes.data as Announcement[]) ?? []);
      setLoading(false);
    })();
  }, [school?.id]);

  // ===== Admin: At-risk students =====
  useEffect(() => {
    if (!school?.id || role !== "school_admin") return;
    const ms = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    (async () => {
      const [{ data: students }, { data: attRows }, { data: dues }] = await Promise.all([
        supabase.from("students").select("id, name").eq("school_id", school.id).eq("is_active", true),
        supabase.from("attendance").select("student_id, status").eq("school_id", school.id).gte("date", ms).lte("date", today),
        supabase.from("fee_dues").select("student_id, amount_due, due_date, is_paid").eq("school_id", school.id).eq("is_paid", false),
      ]);
      const tally = new Map<string, { p: number; t: number }>();
      (attRows ?? []).forEach((r: any) => {
        const t = tally.get(r.student_id) ?? { p: 0, t: 0 };
        t.t += 1;
        if (["present", "late", "leave_approved"].includes(r.status)) t.p += 1;
        tally.set(r.student_id, t);
      });
      const overdueByStudent = new Map<string, number>();
      (dues ?? []).forEach((d: any) => {
        if (d.due_date && d.due_date < today) {
          overdueByStudent.set(d.student_id, (overdueByStudent.get(d.student_id) ?? 0) + Number(d.amount_due));
        }
      });
      const out: AtRiskRow[] = [];
      (students ?? []).forEach((s: any) => {
        const t = tally.get(s.id);
        const pct = t && t.t > 0 ? Math.round((t.p / t.t) * 100) : 100;
        const pending = overdueByStudent.get(s.id) ?? 0;
        if (pct < 75 && pending > 0) out.push({ id: s.id, name: s.name, pct, pending });
      });
      out.sort((a, b) => a.pct - b.pct);
      setAtRisk(out);
    })();
  }, [school?.id, role]);

  // ===== Admin: Weekly digest =====
  const loadDigest = async () => {
    if (!school?.id) return;
    setDigestLoading(true);
    const ms = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

    const [{ data: students }, { data: attRows }, { data: paysThis }, { data: paysLast }, { data: stale }, { data: secs }, { data: attToday }] = await Promise.all([
      supabase.from("students").select("id, name").eq("school_id", school.id).eq("is_active", true),
      supabase.from("attendance").select("student_id, status").eq("school_id", school.id).gte("date", ms).lte("date", today),
      (supabase as any).from("fee_payments").select("amount_paid").eq("school_id", school.id).gte("payment_date", ms).lte("payment_date", today),
      (supabase as any).from("fee_payments").select("amount_paid").eq("school_id", school.id).gte("payment_date", lastMonthStart).lte("payment_date", lastMonthEnd),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("is_read", false).lt("created_at", cutoff),
      supabase.from("sections").select("id, name, classes(name)").eq("school_id", school.id),
      supabase.from("attendance").select("section_id").eq("school_id", school.id).eq("date", today),
    ]);

    const tally = new Map<string, { p: number; t: number; name: string }>();
    (students ?? []).forEach((s: any) => tally.set(s.id, { p: 0, t: 0, name: s.name }));
    (attRows ?? []).forEach((r: any) => {
      const t = tally.get(r.student_id); if (!t) return;
      t.t += 1; if (["present", "late", "leave_approved"].includes(r.status)) t.p += 1;
    });
    const lowAttendance: { id: string; name: string; pct: number }[] = [];
    tally.forEach((v, id) => {
      if (v.t > 0) {
        const pct = Math.round((v.p / v.t) * 100);
        if (pct < 75) lowAttendance.push({ id, name: v.name, pct });
      }
    });
    lowAttendance.sort((a, b) => a.pct - b.pct);

    const feeThisMonth = (paysThis ?? []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
    const feeLastMonth = (paysLast ?? []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
    const staleUnread = (stale as any)?.count ?? 0;
    const markedSections = new Set((attToday ?? []).map((r: any) => r.section_id));
    const sectionsMissingToday = (secs ?? [])
      .filter((s: any) => !markedSections.has(s.id))
      .map((s: any) => ({ id: s.id, label: `${s.classes?.name ?? "Class"} - ${s.name}` }));

    setDigest({ lowAttendance, feeThisMonth, feeLastMonth, staleUnread, sectionsMissingToday });
    setDigestLoading(false);
  };
  useEffect(() => { if (role === "school_admin") loadDigest(); /* eslint-disable-next-line */ }, [school?.id, role]);

  // ===== Teacher: pending leaves for my section's students =====
  const loadPendingLeaves = async () => {
    if (!school?.id || !classTeacherOf?.sectionId) { setPendingLeaves([]); return; }
    const { data: studs } = await supabase.from("students").select("id, name").eq("school_id", school.id).eq("section_id", classTeacherOf.sectionId);
    const studById = new Map<string, string>();
    (studs ?? []).forEach((s: any) => studById.set(s.id, s.name));

    const { data: lr } = await supabase
      .from("leave_requests")
      .select("id, user_id, from_date, to_date, reason, leave_type, status")
      .eq("school_id", school.id)
      .eq("status", "pending")
      .order("from_date", { ascending: true });

    const userIds = Array.from(new Set((lr ?? []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, name").in("user_id", userIds)
      : { data: [] as any[] };
    const nameByUser = new Map<string, string>();
    (profs ?? []).forEach((p: any) => nameByUser.set(p.user_id, p.name));

    const list: PendingLeave[] = [];
    (lr ?? []).forEach((r: any) => {
      const { studentId, clean } = parseLeaveReason(r.reason);
      if (!studentId || !studById.has(studentId)) return; // only my section's students
      list.push({
        id: r.id, user_id: r.user_id,
        parent_name: nameByUser.get(r.user_id) ?? "Parent",
        student_id: studentId, student_name: studById.get(studentId) ?? "—",
        from_date: r.from_date, to_date: r.to_date, reason: clean, leave_type: r.leave_type,
      });
    });
    setPendingLeaves(list);
  };
  useEffect(() => { loadPendingLeaves(); /* eslint-disable-next-line */ }, [school?.id, classTeacherOf?.sectionId]);

  // ===== Teacher: birthdays in my section =====
  useEffect(() => {
    if (!school?.id || !classTeacherOf?.sectionId) { setBirthdays([]); return; }
    (async () => {
      const { data: studs } = await supabase
        .from("students")
        .select("id, name, parent_phone, date_of_birth")
        .eq("school_id", school.id)
        .eq("section_id", classTeacherOf.sectionId)
        .eq("is_active", true);
      const today = new Date();
      const list = (studs ?? []).filter((s: any) => {
        if (!s.date_of_birth) return false;
        const d = new Date(s.date_of_birth);
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      }).map((s: any) => ({ id: s.id, name: s.name, parent_phone: s.parent_phone }));
      setBirthdays(list);

      // Stub WhatsApp send: insert one row per birthday per day (idempotent-ish via unique trigger_type/student_id check)
      if (list.length > 0 && school?.id) {
        for (const s of list) {
          const { count } = await supabase
            .from("whatsapp_logs")
            .select("id", { count: "exact", head: true })
            .eq("school_id", school.id)
            .eq("student_id", s.id)
            .eq("trigger_type", "birthday_wish")
            .gte("created_at", format(today, "yyyy-MM-dd"));
          if ((count ?? 0) === 0) {
            await supabase.from("whatsapp_logs").insert({
              school_id: school.id,
              student_id: s.id,
              to_phone: s.parent_phone,
              message: `Happy Birthday to ${s.name} from ${school.name}`,
              trigger_type: "birthday_wish",
              status: "stub",
            });
          }
        }
      }
    })();
  }, [school?.id, school?.name, classTeacherOf?.sectionId]);

  const approveLeave = async (lr: PendingLeave) => {
    if (!school?.id || !user?.id) return;
    const { error } = await supabase.from("leave_requests").update({ status: "approved" }).eq("id", lr.id);
    if (error) { toast.error(error.message); return; }

    // upsert attendance leave_approved for date range
    const days = eachDayOfInterval({ start: parseISO(lr.from_date), end: parseISO(lr.to_date) });
    const rows = days.map((d) => ({
      school_id: school.id,
      section_id: classTeacherOf!.sectionId,
      student_id: lr.student_id,
      date: format(d, "yyyy-MM-dd"),
      status: "leave_approved" as const,
      notes: `Leave approved: ${lr.reason ?? ""}`.trim(),
      marked_by: profile?.id ?? null,
    }));
    await supabase.from("attendance").upsert(rows as any, { onConflict: "student_id,date" });

    await supabase.from("notifications").insert({
      school_id: school.id, user_id: lr.user_id,
      title: "Leave approved",
      body: `Your leave request for ${lr.student_name} (${lr.from_date} – ${lr.to_date}) has been approved.`,
      type: "leave",
    });
    toast.success("Leave approved");
    loadPendingLeaves();
  };

  const rejectLeave = async () => {
    if (!rejectFor || !school?.id) return;
    const { error } = await supabase.from("leave_requests").update({ status: "rejected" }).eq("id", rejectFor.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      school_id: school.id, user_id: rejectFor.user_id,
      title: "Leave rejected",
      body: `Your leave request for ${rejectFor.student_name} (${rejectFor.from_date} – ${rejectFor.to_date}) was rejected.${rejectNote ? " Note: " + rejectNote : ""}`,
      type: "leave",
    });
    toast.success("Leave rejected");
    setRejectFor(null); setRejectNote("");
    loadPendingLeaves();
  };

  const isParent = role === "parent";
  const isAdmin = role === "school_admin";
  const isTeacher = role === "teacher";

  const statCards = [
    { label: "Total Students", value: stats.totalStudents, icon: Users, soft: "bg-info-soft", color: "text-info", to: "/students", show: !isParent },
    { label: "Teaching Staff", value: stats.totalStaff, icon: GraduationCap, soft: "bg-violet-soft", color: "text-violet", to: "/staff", show: !isParent },
    { label: "Present Today", value: stats.presentToday, sub: `${stats.presentPct}% attendance`, icon: CalendarCheck, soft: "bg-success-soft", color: "text-success", to: "/attendance", show: true },
    { label: "Fee Pending", value: `₹${stats.feePendingK}K`, icon: Wallet, soft: "bg-warning-soft", color: "text-warning", to: "/fees", show: true },
  ].filter((c) => c.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">
          {greeting()}, {profile?.name?.split(" ")[0] ?? "there"} <span className="inline-block">👋</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {school?.name}
        </p>
      </div>

      {classTeacherOf && (
        <div className="rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success flex items-center gap-2">
          <GraduationCap className="h-4 w-4" />
          You are class teacher of {classTeacherOf.name}
        </div>
      )}

      {isTeacher && birthdays.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-medium text-warning flex items-center gap-2">
          <Cake className="h-4 w-4" />
          {birthdays.length === 1
            ? `Today is ${birthdays[0].name}'s birthday 🎉`
            : `Today is the birthday of ${birthdays.map((b) => b.name).join(", ")} 🎉`}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.label} onClick={() => navigate(c.to)} className="card-soft p-4 lg:p-5 text-left hover:shadow-soft hover:-translate-y-0.5 transition">
              <div className="flex items-start justify-between">
                <div className={`stat-icon ${c.soft}`}><Icon className={`h-5 w-5 ${c.color}`} /></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 lg:mt-4">
                <div className="text-2xl lg:text-3xl font-display font-bold">{loading ? "—" : c.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
                {c.sub && <div className="text-[11px] font-medium text-success mt-1">{c.sub}</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* AT-RISK CARD (admin only) */}
      {isAdmin && atRisk.length > 0 && (
        <Card className="p-5 border-destructive/30 bg-[hsl(0_100%_98%)]">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">{atRisk.length} student{atRisk.length === 1 ? "" : "s"} at risk</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Below 75% attendance this month and have overdue fees.</p>
          <div className="space-y-1.5">
            {atRisk.slice(0, 8).map((s) => (
              <button key={s.id} onClick={() => navigate(`/students?id=${s.id}`)} className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-card border bg-card text-sm">
                <span className="font-medium truncate">{s.name}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="text-destructive font-semibold">{s.pct}%</span>
                  <span className="text-muted-foreground">₹{s.pending.toLocaleString("en-IN")} due</span>
                </span>
              </button>
            ))}
            {atRisk.length > 8 && <div className="text-xs text-muted-foreground text-center pt-1">+{atRisk.length - 8} more</div>}
          </div>
        </Card>
      )}

      {/* WEEKLY DIGEST (admin, default Mondays, refresh anytime) */}
      {isAdmin && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /> Weekly digest</h3>
              <p className="text-xs text-muted-foreground">{isMonday ? "Monday recap of last week" : "Snapshot — refresh to recalculate"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadDigest} disabled={digestLoading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${digestLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          {!digest ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground mb-1">Below 75% attendance</div>
                <div className="text-2xl font-semibold">{digest.lowAttendance.length}</div>
                {digest.lowAttendance.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{digest.lowAttendance.slice(0, 5).map((s) => s.name).join(", ")}</div>
                )}
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground mb-1">Fee collection</div>
                <div className="text-2xl font-semibold">₹{digest.feeThisMonth.toLocaleString("en-IN")}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Last month: ₹{digest.feeLastMonth.toLocaleString("en-IN")}</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MessageSquareWarning className="h-3 w-3" /> Unread messages &gt; 48h</div>
                <div className="text-2xl font-semibold">{digest.staleUnread}</div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground mb-1">Sections without attendance today</div>
                <div className="text-2xl font-semibold">{digest.sectionsMissingToday.length}</div>
                {digest.sectionsMissingToday.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{digest.sectionsMissingToday.map((s) => s.label).join(", ")}</div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TEACHER: PENDING LEAVES */}
      {isTeacher && classTeacherOf && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Pending leave requests</h3>
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">{pendingLeaves.length}</span>
          </div>
          {pendingLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingLeaves.map((lr) => (
                <div key={lr.id} className="rounded-lg border p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{lr.student_name}</div>
                    <div className="text-xs text-muted-foreground">{lr.parent_name} · {lr.from_date} → {lr.to_date}</div>
                    {lr.reason && <div className="text-xs text-foreground/80 mt-1 line-clamp-2">{lr.reason}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRejectFor(lr)}>
                      <XCircle className="mr-1 h-3 w-3" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => approveLeave(lr)}>
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-display font-semibold">Weekly Attendance</h2>
              <p className="text-xs text-muted-foreground">Mon – Sat overview</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />Present</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-200" />Absent</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK_DATA} barGap={4}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="present" radius={[8, 8, 0, 0]} fill="hsl(var(--success))">
                  {WEEK_DATA.map((_, i) => <Cell key={i} fill="hsl(var(--success))" />)}
                </Bar>
                <Bar dataKey="absent" radius={[8, 8, 0, 0]} fill="hsl(var(--brand-200))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5">
          <h2 className="text-base font-display font-semibold mb-1">Today's Snapshot</h2>
          <p className="text-xs text-muted-foreground mb-5">Live attendance</p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground">Present</span>
                <span className="text-muted-foreground">{stats.presentToday}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all" style={{ width: `${stats.presentPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-foreground">Absent</span>
                <span className="text-muted-foreground">{Math.max(0, stats.totalStudents - stats.presentToday)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${100 - stats.presentPct}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-success-soft p-4 text-center">
            <div className="text-3xl font-display font-bold text-success">{stats.presentPct}%</div>
            <div className="text-[11px] text-success font-medium mt-0.5">Attendance Today</div>
          </div>
        </div>
      </div>

      {/* Announcements + Quick actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-display font-semibold">Recent Announcements</h2>
            <button onClick={() => navigate("/connect")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="space-y-2">
            {announcements.length === 0 && !loading && (
              <li className="text-sm text-muted-foreground py-6 text-center">No announcements yet.</li>
            )}
            {announcements.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl p-3 hover:bg-muted/60 transition">
                <div className="h-9 w-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground line-clamp-1">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-display font-semibold px-1">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={() => navigate(a.to)} className={`${a.gradient} rounded-2xl p-4 text-left text-primary-foreground shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition`}>
                  <Icon className="h-6 w-6" />
                  <div className="mt-6 text-sm font-semibold leading-tight">{a.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(v) => { if (!v) { setRejectFor(null); setRejectNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
          </DialogHeader>
          <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} placeholder="Optional note for parent…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectNote(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={rejectLeave}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
