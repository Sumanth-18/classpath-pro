import { useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, isToday, isFuture } from "date-fns";
import { CalendarIcon, Loader2, Save, CheckCheck, MoreHorizontal, MessageCircle, History, UserPlus2 } from "lucide-react";
import { SubstituteLogDialog } from "@/components/SubstituteLogDialog";
import toast from "react-hot-toast";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Status = "present" | "absent" | "late" | "leave_approved";

interface SectionOpt {
  id: string;
  label: string;
  class_id: string;
}

interface StudentRow {
  id: string;
  name: string;
  admission_number: string;
  parent_phone: string | null;
  section_id: string | null;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  status: Status;
  notes: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave_approved: "Leave approved",
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function pctColor(pct: number) {
  if (pct >= 85) return "text-success bg-success-soft";
  if (pct >= 75) return "text-warning bg-warning-soft";
  return "text-destructive bg-[hsl(0_100%_96%)]";
}

function statusPillClass(s: Status) {
  switch (s) {
    case "present": return "bg-success-soft text-success";
    case "absent": return "bg-[hsl(0_100%_96%)] text-destructive";
    case "late": return "bg-warning-soft text-warning";
    case "leave_approved": return "bg-info-soft text-info";
  }
}

export default function Attendance() {
  const { user, profile, school, role } = useAuth();
  const isAdmin = role === "school_admin";

  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [monthPct, setMonthPct] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suppressNotify, setSuppressNotify] = useState(false);

  // backdate edit reason dialog
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [pendingChange, setPendingChange] = useState<null | { studentId: string; newStatus: Status }>(null);

  // status picker dialog (long-press / ⋯)
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // substitute log
  const [subOpen, setSubOpen] = useState(false);
  const [subInfo, setSubInfo] = useState<{ name: string } | null>(null);

  const isPast = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }, [date]);

  const dateStr = useMemo(() => format(date, "yyyy-MM-dd"), [date]);

  // ------- Load sections (admin: all, teacher: assigned) -------
  useEffect(() => {
    if (!school?.id || !user?.id) return;

    (async () => {
      let q = supabase
        .from("sections")
        .select("id, name, class_id, class_teacher_id, classes!inner(name)")
        .eq("school_id", school.id);

      if (!isAdmin) {
        // teacher: limit to assigned sections (class teacher OR teacher_assignment)
        const [{ data: ownSec }, { data: ta }] = await Promise.all([
          supabase.from("sections").select("id").eq("school_id", school.id).eq("class_teacher_id", profile?.id ?? ""),
          supabase.from("teacher_assignments").select("section_id").eq("school_id", school.id).eq("teacher_id", profile?.id ?? ""),
        ]);
        const ids = Array.from(new Set([...(ownSec ?? []).map((s: any) => s.id), ...(ta ?? []).map((t: any) => t.section_id)]));
        if (ids.length === 0) { setSections([]); return; }
        q = q.in("id", ids);
      }

      const { data, error } = await q.order("name", { ascending: true });
      if (error) { toast.error("Could not load classes"); return; }

      // Resolve class teacher names
      const teacherIds = Array.from(
        new Set((data ?? []).map((s: any) => s.class_teacher_id).filter(Boolean) as string[])
      );
      const nameMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", teacherIds);
        (profs ?? []).forEach((p: any) => nameMap.set(p.id, p.name));
      }

      const opts: SectionOpt[] = (data ?? []).map((s: any) => {
        const base = `${s.classes?.name ?? "Class"} - ${s.name}`;
        const tname = s.class_teacher_id ? nameMap.get(s.class_teacher_id) : null;
        return {
          id: s.id,
          class_id: s.class_id,
          label: tname ? `${base} — ${tname}` : base,
        };
      });
      setSections(opts);
      if (opts.length && !sectionId) setSectionId(opts[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.id, user?.id, profile?.id, isAdmin]);

  // ------- Load students + existing attendance + month % -------
  useEffect(() => {
    if (!school?.id || !sectionId) { setStudents([]); setRecords({}); return; }
    setLoading(true);

    (async () => {
      const { data: studs, error: e1 } = await supabase
        .from("students")
        .select("id, name, admission_number, parent_phone, section_id")
        .eq("school_id", school.id)
        .eq("section_id", sectionId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (e1) { toast.error("Could not load students"); setLoading(false); return; }
      const list = (studs ?? []) as StudentRow[];
      setStudents(list);

      const ids = list.map((s) => s.id);
      if (ids.length === 0) { setRecords({}); setMonthPct({}); setLoading(false); return; }

      const monthStart = format(startOfMonth(date), "yyyy-MM-dd");

      const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
        supabase.from("attendance").select("id, student_id, status, notes").eq("school_id", school.id).eq("date", dateStr).in("student_id", ids),
        supabase.from("attendance").select("student_id, status, date").eq("school_id", school.id).gte("date", monthStart).lte("date", dateStr).in("student_id", ids),
      ]);

      const map: Record<string, AttendanceRecord> = {};
      list.forEach((s) => { map[s.id] = { student_id: s.id, status: "absent", notes: null }; });
      (dayRows ?? []).forEach((r: any) => { map[r.student_id] = { id: r.id, student_id: r.student_id, status: r.status as Status, notes: r.notes }; });
      setRecords(map);

      const tally: Record<string, { p: number; t: number }> = {};
      list.forEach((s) => { tally[s.id] = { p: 0, t: 0 }; });
      (monthRows ?? []).forEach((r: any) => {
        const t = tally[r.student_id]; if (!t) return;
        t.t += 1;
        if (r.status === "present" || r.status === "late" || r.status === "leave_approved") t.p += 1;
      });
      const pcts: Record<string, number> = {};
      Object.entries(tally).forEach(([id, v]) => { pcts[id] = v.t === 0 ? 100 : Math.round((v.p / v.t) * 100); });
      setMonthPct(pcts);
      setLoading(false);
    })();
  }, [school?.id, sectionId, dateStr, date]);

  const counts = useMemo(() => {
    let p = 0, a = 0, l = 0, lv = 0;
    Object.values(records).forEach((r) => {
      if (r.status === "present") p += 1;
      else if (r.status === "absent") a += 1;
      else if (r.status === "late") l += 1;
      else if (r.status === "leave_approved") lv += 1;
    });
    return { p, a, l, lv };
  }, [records]);

  // ------- toggle / picker -------
  const setStatus = (studentId: string, newStatus: Status) => {
    setRecords((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? { student_id: studentId, status: "absent", notes: null }), status: newStatus } }));
  };

  const requestStatusChange = (studentId: string, newStatus: Status) => {
    if (isPast && isAdmin) {
      setPendingChange({ studentId, newStatus });
      setReasonText("");
      setReasonOpen(true);
      return;
    }
    setStatus(studentId, newStatus);
  };

  const confirmReason = () => {
    if (!pendingChange) return;
    if (reasonText.trim().length < 3) { toast.error("Please enter a reason"); return; }
    setRecords((prev) => ({
      ...prev,
      [pendingChange.studentId]: { ...(prev[pendingChange.studentId] ?? { student_id: pendingChange.studentId, status: "absent", notes: null }), status: pendingChange.newStatus, notes: reasonText.trim() },
    }));
    setReasonOpen(false);
    setPendingChange(null);
  };

  // long-press
  const lpTimers = useRef<Record<string, number>>({});
  const startLongPress = (studentId: string) => {
    if (lpTimers.current[studentId]) window.clearTimeout(lpTimers.current[studentId]);
    lpTimers.current[studentId] = window.setTimeout(() => { setPickerFor(studentId); }, 550);
  };
  const cancelLongPress = (studentId: string) => {
    if (lpTimers.current[studentId]) { window.clearTimeout(lpTimers.current[studentId]); delete lpTimers.current[studentId]; }
  };

  const markAllPresent = () => {
    setRecords((prev) => {
      const next: Record<string, AttendanceRecord> = {};
      students.forEach((s) => { next[s.id] = { ...(prev[s.id] ?? { student_id: s.id, status: "absent", notes: null }), status: "present" }; });
      return next;
    });
  };

  // ------- Save -------
  const handleSave = async () => {
    if (!school?.id || !user?.id || !sectionId) return;
    if (isFuture(date) && !isToday(date)) { toast.error("Cannot mark future dates"); return; }
    if (students.length === 0) { toast.error("No students in this class"); return; }

    setSaving(true);
    try {
      // diff for audit (overrides = late/leave_approved, past_edit = backdated changes)
      const { data: existing } = await supabase
        .from("attendance")
        .select("id, student_id, status, notes")
        .eq("school_id", school.id)
        .eq("date", dateStr)
        .in("student_id", students.map((s) => s.id));

      const existMap = new Map<string, { id: string; status: string; notes: string | null }>();
      (existing ?? []).forEach((r: any) => existMap.set(r.student_id, r));

      const upserts = students.map((s) => {
        const r = records[s.id];
        return {
          school_id: school.id,
          section_id: sectionId,
          student_id: s.id,
          date: dateStr,
          status: r?.status ?? "absent",
          notes: r?.notes ?? null,
          marked_by: profile?.id ?? null,
        };
      });

      const { error: upErr } = await supabase
        .from("attendance")
        .upsert(upserts, { onConflict: "student_id,date" });

      if (upErr) throw upErr;

      // audit entries
      const auditRows: any[] = [];
      students.forEach((s) => {
        const newR = records[s.id]; if (!newR) return;
        const old = existMap.get(s.id);
        const changed = !old || old.status !== newR.status || (old.notes ?? null) !== (newR.notes ?? null);

        if (newR.status === "late" || newR.status === "leave_approved") {
          auditRows.push({
            school_id: school.id, student_id: s.id, action: "override",
            date: dateStr, old_status: old?.status ?? null, new_status: newR.status,
            reason: newR.notes ?? null, performed_by: user.id,
          });
        }
        if (isPast && changed) {
          auditRows.push({
            school_id: school.id, student_id: s.id, action: "past_edit",
            date: dateStr, old_status: old?.status ?? null, new_status: newR.status,
            reason: newR.notes ?? null, performed_by: user.id,
          });
        }
      });

      if (auditRows.length) {
        await supabase.from("attendance_audit").insert(auditRows);
      }

      // WhatsApp dispatch (stub) — log to audit; never actually contacts a provider
      const absentees = students.filter((s) => records[s.id]?.status === "absent");
      let sentCount = 0;
      if (!suppressNotify && absentees.length > 0) {
        const sends = absentees
          .filter((s) => !!s.parent_phone)
          .map((s) => ({
            school_id: school.id, student_id: s.id, action: "whatsapp_send",
            date: dateStr, new_status: "absent", performed_by: user.id,
            payload: {
              channel: "whatsapp", status: "stubbed",
              to: s.parent_phone,
              message: `Dear Parent, your child ${s.name} (Adm. ${s.admission_number}) was marked absent on ${format(date, "PPP")}.`,
            },
          }));
        if (sends.length) {
          await supabase.from("attendance_audit").insert(sends);
          sentCount = sends.length;
        }
      }

      toast.success(
        suppressNotify
          ? "Attendance saved (notifications suppressed)"
          : `Attendance saved${sentCount ? ` · ${sentCount} parent notice queued` : ""}`
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------- UI ----------------------------
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark daily attendance for your class</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-md border bg-card px-3 py-2 text-sm font-medium">
              {sections.find((s) => s.id === sectionId)?.label ?? "No assigned class"}
            </div>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                disabled={(d) => d > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* past-date banner */}
      {isPast && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <History className="h-4 w-4" />
          {isAdmin
            ? "Editing a past date — every change will require a reason and is recorded in the audit log."
            : "Past date is read-only for teachers. Ask an administrator to edit."}
        </div>
      )}

      {/* toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={markAllPresent} variant="secondary" disabled={loading || (isPast && !isAdmin)}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all present
            </Button>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Suppress WhatsApp</span>
              <Switch checked={suppressNotify} onCheckedChange={setSuppressNotify} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-success-soft px-3 py-1 font-medium text-success">Present {counts.p}</span>
            <span className="rounded-full bg-warning-soft px-3 py-1 font-medium text-warning">Late {counts.l}</span>
            <span className="rounded-full bg-info-soft px-3 py-1 font-medium text-info">Leave {counts.lv}</span>
            <span className="rounded-full bg-[hsl(0_100%_96%)] px-3 py-1 font-medium text-destructive">Absent {counts.a}</span>
          </div>
        </div>
      </Card>

      {/* list */}
      <Card className="divide-y">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {sectionId ? "No active students in this class." : "Select a class to begin."}
          </div>
        ) : (
          students.map((s) => {
            const rec = records[s.id];
            const status = rec?.status ?? "absent";
            const pct = monthPct[s.id] ?? 100;
            const present = status === "present";
            const disabled = isPast && !isAdmin;

            return (
              <div key={s.id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-brand-50 text-brand-600 font-semibold">{getInitials(s.name)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Adm. {s.admission_number}</span>
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", pctColor(pct))}>{pct}%</span>
                  </div>
                </div>

                {(status === "late" || status === "leave_approved") && (
                  <span className={cn("hidden rounded-full px-2 py-1 text-xs font-medium sm:inline-flex", statusPillClass(status))}>
                    {STATUS_LABEL[status]}
                  </span>
                )}

                <div
                  className="flex items-center gap-2"
                  onMouseDown={() => !disabled && startLongPress(s.id)}
                  onMouseUp={() => cancelLongPress(s.id)}
                  onMouseLeave={() => cancelLongPress(s.id)}
                  onTouchStart={() => !disabled && startLongPress(s.id)}
                  onTouchEnd={() => cancelLongPress(s.id)}
                >
                  <span className={cn("text-xs font-medium", present ? "text-success" : "text-destructive")}>
                    {present ? "P" : status === "absent" ? "A" : status === "late" ? "L" : "LV"}
                  </span>
                  <Switch
                    checked={present}
                    disabled={disabled}
                    onCheckedChange={(v) => requestStatusChange(s.id, v ? "present" : "absent")}
                    className="data-[state=checked]:bg-success data-[state=unchecked]:bg-destructive"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Set status</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(["present", "absent", "late", "leave_approved"] as Status[]).map((s2) => (
                        <DropdownMenuItem key={s2} onClick={() => requestStatusChange(s.id, s2)}>
                          {STATUS_LABEL[s2]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* save bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-elevated">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{counts.p + counts.l + counts.lv}</span> marked present ·{" "}
            <span className="font-medium text-foreground">{counts.a}</span> absent
          </div>
          <Button onClick={handleSave} disabled={saving || loading || students.length === 0 || (isPast && !isAdmin)}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save attendance
          </Button>
        </Card>
      </div>

      {/* long-press picker dialog */}
      <Dialog open={!!pickerFor} onOpenChange={(v) => !v && setPickerFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set status</DialogTitle>
            <DialogDescription>
              {pickerFor ? students.find((s) => s.id === pickerFor)?.name : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {(["present", "absent", "late", "leave_approved"] as Status[]).map((s) => (
              <Button key={s} variant="outline" onClick={() => { if (pickerFor) requestStatusChange(pickerFor, s); setPickerFor(null); }}>
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* backdate reason dialog */}
      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for past-date edit</DialogTitle>
            <DialogDescription>This change will be recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="e.g. Late arrival confirmed by class teacher"
            maxLength={500}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasonOpen(false); setPendingChange(null); }}>Cancel</Button>
            <Button onClick={confirmReason}>Apply change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
