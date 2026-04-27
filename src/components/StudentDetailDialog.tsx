import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, User, Hash, Calendar, GraduationCap, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | null;
}

interface StudentDetail {
  id: string;
  name: string;
  admission_number: string;
  gender: string | null;
  date_of_birth: string | null;
  photo_url: string | null;
  created_at: string;
  sections: { name: string; classes: { name: string } | null } | null;
}

interface Counts {
  present: number;
  absent: number;
  late: number;
  totalDue: number;
  totalPaid: number;
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function StudentDetailDialog({ open, onOpenChange, studentId }: Props) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [counts, setCounts] = useState<Counts>({ present: 0, absent: 0, late: 0, totalDue: 0, totalPaid: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !studentId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setStudent(null);

      const [{ data: s }, { data: att }, { data: dues }, { data: pays }] = await Promise.all([
        supabase
          .from("students")
          .select("id, name, admission_number, gender, date_of_birth, photo_url, created_at, sections (name, classes (name))")
          .eq("id", studentId)
          .maybeSingle(),
        supabase.from("attendance").select("status").eq("student_id", studentId),
        supabase.from("fee_dues").select("amount_due, is_paid").eq("student_id", studentId),
        supabase.from("fee_payments").select("amount_paid").eq("student_id", studentId),
      ]);

      if (cancelled) return;

      setStudent((s as any) ?? null);
      const present = (att ?? []).filter((a: any) => a.status === "present").length;
      const absent = (att ?? []).filter((a: any) => a.status === "absent").length;
      const late = (att ?? []).filter((a: any) => a.status === "late").length;
      const totalDue = (dues ?? [])
        .filter((d: any) => !d.is_paid)
        .reduce((sum: number, d: any) => sum + Number(d.amount_due ?? 0), 0);
      const totalPaid = (pays ?? []).reduce((sum: number, p: any) => sum + Number(p.amount_paid ?? 0), 0);
      setCounts({ present, absent, late, totalDue, totalPaid });
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [open, studentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Student details</DialogTitle>
        </DialogHeader>

        {loading || !student ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40">
              <div className="h-14 w-14 rounded-full bg-gradient-brand text-primary-foreground flex items-center justify-center text-lg font-semibold">
                {getInitials(student.name)}
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold truncate">{student.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {student.admission_number}
                </div>
              </div>
            </div>

            {/* Detail rows */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow icon={<GraduationCap className="h-4 w-4" />} label="Class">
                {student.sections
                  ? `${student.sections.classes?.name ?? ""}-${student.sections.name}`
                  : "—"}
              </DetailRow>
              <DetailRow icon={<User className="h-4 w-4" />} label="Gender">
                <span className="capitalize">{student.gender ?? "—"}</span>
              </DetailRow>
              <DetailRow icon={<Calendar className="h-4 w-4" />} label="Date of birth">
                {formatDate(student.date_of_birth)}
              </DetailRow>
              <DetailRow icon={<Hash className="h-4 w-4" />} label="Enrolled on">
                {formatDate(student.created_at)}
              </DetailRow>
            </div>

            {/* Stats */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Snapshot
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox label="Present" value={counts.present} tone="success" />
                <StatBox label="Absent" value={counts.absent} tone="destructive" />
                <StatBox label="Late" value={counts.late} tone="muted" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <StatBox label="Fees paid" value={`₹${counts.totalPaid.toLocaleString("en-IN")}`} tone="success" />
                <StatBox label="Fees pending" value={`₹${counts.totalDue.toLocaleString("en-IN")}`} tone="destructive" />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{children}</div>
      </div>
    </div>
  );
}

function StatBox({
  label, value, tone,
}: { label: string; value: string | number; tone: "success" | "destructive" | "muted" }) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
