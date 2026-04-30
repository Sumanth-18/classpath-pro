import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, GraduationCap, CalendarCheck, Wallet, Bell, ArrowRight,
  ClipboardList, BookOpen, ChevronRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface Stats {
  totalStudents: number;
  totalStaff: number;
  presentToday: number;
  presentPct: number;
  feePendingK: number;
}

interface Announcement {
  id: string;
  title: string;
  created_at: string;
}

const WEEK_DATA = [
  { day: "Mon", present: 92, absent: 8 },
  { day: "Tue", present: 88, absent: 12 },
  { day: "Wed", present: 94, absent: 6 },
  { day: "Thu", present: 90, absent: 10 },
  { day: "Fri", present: 86, absent: 14 },
  { day: "Sat", present: 78, absent: 22 },
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
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const { profile, school, role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalStaff: 0, presentToday: 0, presentPct: 0, feePendingK: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [classTeacherOf, setClassTeacherOf] = useState<string | null>(null);

  useEffect(() => {
    if (!school?.id || !profile?.id || role !== "teacher") { setClassTeacherOf(null); return; }
    (async () => {
      const { data } = await supabase
        .from("sections")
        .select("name, classes!inner(name)")
        .eq("school_id", school.id)
        .eq("class_teacher_id", profile.id)
        .maybeSingle();
      if (data) setClassTeacherOf(`${(data as any).classes?.name ?? "Class"} ${(data as any).name}`);
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
      const presentToday = att.filter((a) => a.status === "present" || a.status === "late").length;
      const presentPct = att.length > 0 ? Math.round((presentToday / att.length) * 100) : 0;
      const feePendingTotal = (duesRes.data ?? []).reduce((sum, d: any) => sum + Number(d.amount_due ?? 0), 0);

      setStats({
        totalStudents,
        totalStaff,
        presentToday,
        presentPct,
        feePendingK: Math.round(feePendingTotal / 1000),
      });
      setAnnouncements((annRes.data as Announcement[]) ?? []);
      setLoading(false);
    })();
  }, [school?.id]);

  const isParent = role === "parent";

  const statCards = [
    { label: "Total Students", value: stats.totalStudents, icon: Users, soft: "bg-info-soft", color: "text-info", to: "/students", show: !isParent },
    { label: "Teaching Staff", value: stats.totalStaff, icon: GraduationCap, soft: "bg-violet-soft", color: "text-violet", to: "/staff", show: !isParent },
    { label: "Present Today", value: stats.presentToday, sub: `${stats.presentPct}% attendance`, icon: CalendarCheck, soft: "bg-success-soft", color: "text-success", to: "/attendance", show: true },
    { label: "Fee Pending", value: `₹${stats.feePendingK}K`, icon: Wallet, soft: "bg-warning-soft", color: "text-warning", to: "/fees", show: !isParent || true },
  ].filter((c) => c.show);

  return (
    <div className="space-y-6">
      {/* Greeting */}
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
          You are class teacher of {classTeacherOf}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => navigate(c.to)}
              className="card-soft p-4 lg:p-5 text-left hover:shadow-soft hover:-translate-y-0.5 transition"
            >
              <div className="flex items-start justify-between">
                <div className={`stat-icon ${c.soft}`}>
                  <Icon className={`h-5 w-5 ${c.color}`} />
                </div>
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

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Weekly attendance */}
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
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Bar dataKey="present" radius={[8, 8, 0, 0]} fill="hsl(var(--success))">
                  {WEEK_DATA.map((_, i) => <Cell key={i} fill="hsl(var(--success))" />)}
                </Bar>
                <Bar dataKey="absent" radius={[8, 8, 0, 0]} fill="hsl(var(--brand-200))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today snapshot */}
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
                <button
                  key={a.label}
                  onClick={() => navigate(a.to)}
                  className={`${a.gradient} rounded-2xl p-4 text-left text-primary-foreground shadow-soft hover:shadow-elevated hover:-translate-y-0.5 transition`}
                >
                  <Icon className="h-6 w-6" />
                  <div className="mt-6 text-sm font-semibold leading-tight">{a.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
