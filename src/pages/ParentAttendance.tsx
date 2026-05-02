import { useEffect, useMemo, useState } from "react";
import { useChild } from "@/contexts/ChildContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, CalendarIcon, FileEdit } from "lucide-react";
import { addMonths, format, getDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isWeekend, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

type Status = "present" | "absent" | "late" | "leave_approved";

const STATUS_COLOR: Record<Status, string> = {
  present: "bg-success text-white",
  absent: "bg-destructive text-white",
  late: "bg-warning text-white",
  leave_approved: "bg-info text-white",
};

const LEGEND = [
  { label: "Present", className: "bg-success" },
  { label: "Late", className: "bg-warning" },
  { label: "Leave", className: "bg-info" },
  { label: "Absent", className: "bg-destructive" },
  { label: "Weekend / no data", className: "bg-muted" },
];

export default function ParentAttendance() {
  const { activeChild } = useChild();
  const { user, school } = useAuth();
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [byDate, setByDate] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);

  // leave dialog
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date | undefined>(new Date());
  const [to, setTo] = useState<Date | undefined>(new Date());
  const [leaveType, setLeaveType] = useState("personal");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeChild?.id) { setByDate({}); return; }
    setLoading(true);
    const ms = format(startOfMonth(month), "yyyy-MM-dd");
    const me = format(endOfMonth(month), "yyyy-MM-dd");
    (async () => {
      const { data } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("student_id", activeChild.id)
        .gte("date", ms).lte("date", me);
      const m: Record<string, Status> = {};
      (data ?? []).forEach((r: any) => { m[r.date] = r.status as Status; });
      setByDate(m);
      setLoading(false);
    })();
  }, [activeChild?.id, month]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const all = eachDayOfInterval({ start, end });
    const padStart = getDay(start); // 0 Sun .. 6 Sat
    return { all, padStart };
  }, [month]);

  const monthPct = useMemo(() => {
    const present = Object.values(byDate).filter((s) => s === "present" || s === "late" || s === "leave_approved").length;
    const total = Object.values(byDate).length;
    return total > 0 ? Math.round((present / total) * 100) : null;
  }, [byDate]);

  const submitLeave = async () => {
    if (!user?.id || !school?.id || !activeChild?.id) return;
    if (!from || !to) { toast.error("Select dates"); return; }
    if (isAfter(from, to)) { toast.error("From date must be before To date"); return; }
    if (reason.trim().length < 3) { toast.error("Add a reason"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      school_id: school.id,
      user_id: user.id,
      from_date: format(from, "yyyy-MM-dd"),
      to_date: format(to, "yyyy-MM-dd"),
      student_id: activeChild.id,
      reason: `${leaveType}: ${reason.trim()}`,
      leave_type: leaveType,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Leave request submitted");
    setOpen(false);
    setReason("");
  };

  if (!activeChild) return <div className="p-12 text-center text-sm text-muted-foreground">No child selected.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">{activeChild.name} · {activeChild.classLabel}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <FileEdit className="mr-2 h-4 w-4" /> Request Leave
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-semibold">{format(month, "MMMM yyyy")}</div>
          <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: days.padStart }).map((_, i) => <div key={`p-${i}`} />)}
          {days.all.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const status = byDate[key];
            const weekend = isWeekend(d);
            let cls = "bg-muted text-muted-foreground";
            if (status) cls = STATUS_COLOR[status];
            else if (weekend) cls = "bg-muted/60 text-muted-foreground";
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium", cls)}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-3 text-xs">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-full", l.className)} />{l.label}
              </span>
            ))}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Monthly attendance:</span>{" "}
            <span className="font-semibold text-foreground">{monthPct == null ? "—" : `${monthPct}%`}</span>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request leave for {activeChild.name}</DialogTitle>
            <DialogDescription>The class teacher will review and approve.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />{from ? format(from, "PPP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={from} onSelect={setFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal mt-1">
                      <CalendarIcon className="mr-2 h-4 w-4" />{to ? format(to, "PPP") : "Pick"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={to} onSelect={setTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Input value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="mt-1" placeholder="e.g. medical, personal" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1" placeholder="Explain briefly" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitLeave} disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
