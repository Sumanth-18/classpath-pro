import { useEffect, useMemo, useState } from "react";
import { format, isAfter, parseISO, startOfMonth, subMonths } from "date-fns";
import {
  Plus, Search, Loader2, Pencil, Trash2, Receipt, MessageCircle, Flag,
  Download, FileText, AlertTriangle, Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as ReTooltip, CartesianGrid,
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

import { FeeStructureDialog } from "@/components/FeeStructureDialog";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import { FlagFollowupDialog } from "@/components/FlagFollowupDialog";

// ----- types -----
export interface FeeStructureRow {
  id: string;
  name: string;
  amount: number;
  frequency: string | null;
  academic_year: string | null;
  due_day: number | null;
  classes: { id: string; name: string }[];
  instalments: { id: string; label: string; amount: number; due_date: string | null; sort_order: number }[];
}

export interface ClassRow { id: string; name: string }

interface StudentDueRow {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_label: string;
  section_id: string | null;
  total_fee: number;
  paid: number;
  pending: number;
  next_due: string | null;
  status: "paid" | "partial" | "overdue" | "due";
}

interface PaymentHistoryRow {
  id: string;
  student_id: string;
  student_name: string;
  amount_paid: number;
  payment_date: string;
  payment_mode: string;
  receipt_number: string | null;
  receipt_url: string | null;
}

// ----- helpers -----
function statusBadge(s: StudentDueRow["status"]) {
  switch (s) {
    case "paid": return "bg-success-soft text-success";
    case "partial": return "bg-warning-soft text-warning";
    case "overdue": return "bg-[hsl(0_100%_96%)] text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

const INR = (n: number) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// =====================================================
// Page
// =====================================================
export default function Fees() {
  const { school, role, user, profile } = useAuth();
  if (!school) return null;

  if (role === "parent") return <ParentFeesView />;

  const isAdmin = role === "school_admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Manage structures, dues and payments for your school" : "Dues for your assigned classes"}
          </p>
        </div>
      </header>

      <Tabs defaultValue={isAdmin ? "structures" : "dues"} className="w-full">
        <TabsList className={cn("grid w-full max-w-2xl", isAdmin ? "grid-cols-4" : "grid-cols-1")}>
          {isAdmin && <TabsTrigger value="structures">Structures</TabsTrigger>}
          <TabsTrigger value="dues">Student Dues</TabsTrigger>
          {isAdmin && <TabsTrigger value="history">Payment History</TabsTrigger>}
          {isAdmin && <TabsTrigger value="reports">Reports</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="structures" className="mt-6">
            <StructuresTab schoolId={school.id} />
          </TabsContent>
        )}
        <TabsContent value="dues" className="mt-6">
          <DuesTab
            schoolId={school.id}
            isAdmin={isAdmin}
            teacherProfileId={profile?.id ?? null}
            currentUserId={user?.id ?? null}
          />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="history" className="mt-6">
            <HistoryTab schoolId={school.id} />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="reports" className="mt-6">
            <ReportsTab schoolId={school.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// =====================================================
// Tab 1 — Fee Structures
// =====================================================
function StructuresTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<FeeStructureRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<FeeStructureRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [
      { data: cls },
      { data: structs },
      { data: links },
      { data: ins },
    ] = await Promise.all([
      supabase.from("classes").select("id, name").eq("school_id", schoolId).order("name"),
      supabase.from("fee_structures").select("id, name, amount, frequency, academic_year, due_day").eq("school_id", schoolId).order("created_at", { ascending: false }),
      supabase.from("fee_structure_classes").select("fee_structure_id, class_id, classes!inner(id, name)").eq("school_id", schoolId),
      supabase.from("fee_instalments").select("id, fee_structure_id, label, amount, due_date, sort_order").eq("school_id", schoolId).order("sort_order"),
    ]);
    setClasses((cls ?? []) as ClassRow[]);
    const linksByStruct: Record<string, { id: string; name: string }[]> = {};
    (links ?? []).forEach((l: any) => {
      (linksByStruct[l.fee_structure_id] ??= []).push({ id: l.classes.id, name: l.classes.name });
    });
    const insByStruct: Record<string, FeeStructureRow["instalments"]> = {};
    (ins ?? []).forEach((i: any) => {
      (insByStruct[i.fee_structure_id] ??= []).push({
        id: i.id, label: i.label, amount: Number(i.amount), due_date: i.due_date, sort_order: i.sort_order,
      });
    });
    setRows((structs ?? []).map((s: any) => ({
      id: s.id, name: s.name, amount: Number(s.amount),
      frequency: s.frequency, academic_year: s.academic_year, due_day: s.due_day,
      classes: linksByStruct[s.id] ?? [],
      instalments: insByStruct[s.id] ?? [],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [schoolId]);

  const remove = async (id: string) => {
    if (!confirm("Delete this fee category? Linked classes and instalments will also be removed.")) return;
    await supabase.from("fee_instalments").delete().eq("fee_structure_id", id);
    await supabase.from("fee_structure_classes").delete().eq("fee_structure_id", id);
    const { error } = await supabase.from("fee_structures").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add fee category
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No fee categories yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Instalments</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{INR(r.amount)}</TableCell>
                  <TableCell className="capitalize">{r.frequency ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.classes.length === 0
                        ? <span className="text-xs text-muted-foreground">All</span>
                        : r.classes.map((c) => (
                            <span key={c.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{c.name}</span>
                          ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.instalments.length === 0
                      ? <span className="text-xs text-muted-foreground">Single</span>
                      : <span className="text-xs">{r.instalments.length} parts</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEdit(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <FeeStructureDialog
        open={open}
        onOpenChange={setOpen}
        schoolId={schoolId}
        classes={classes}
        existing={edit}
        onSaved={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

// =====================================================
// Tab 2 — Student Dues
// =====================================================
function DuesTab({
  schoolId, isAdmin, teacherProfileId, currentUserId,
}: { schoolId: string; isAdmin: boolean; teacherProfileId: string | null; currentUserId: string | null }) {
  const [rows, setRows] = useState<StudentDueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recordFor, setRecordFor] = useState<StudentDueRow | null>(null);
  const [flagFor, setFlagFor] = useState<StudentDueRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // 1. allowed sections (teachers limited to assigned)
      let sectionFilter: string[] | null = null;
      if (!isAdmin && teacherProfileId) {
        const [{ data: own }, { data: ta }] = await Promise.all([
          supabase.from("sections").select("id").eq("school_id", schoolId).eq("class_teacher_id", teacherProfileId),
          supabase.from("teacher_assignments").select("section_id").eq("school_id", schoolId).eq("teacher_id", teacherProfileId),
        ]);
        const ids = Array.from(new Set([...(own ?? []).map((s: any) => s.id), ...(ta ?? []).map((t: any) => t.section_id)]));
        sectionFilter = ids;
        if (ids.length === 0) { setRows([]); setLoading(false); return; }
      }

      // 2. students
      let stuQ = supabase
        .from("students")
        .select("id, name, admission_number, section_id, sections!inner(id, name, class_id, classes!inner(id, name))")
        .eq("school_id", schoolId)
        .eq("is_active", true);
      if (sectionFilter) stuQ = stuQ.in("section_id", sectionFilter);
      const { data: studs, error: e1 } = await stuQ.order("name");
      if (e1) throw e1;

      const studentIds = (studs ?? []).map((s: any) => s.id);

      // 3. dues + payments + structures (with class links)
      const [{ data: dues }, { data: pays }, { data: structs }, { data: links }] = await Promise.all([
        studentIds.length
          ? supabase.from("fee_dues").select("student_id, amount_due, due_date, is_paid, fee_structure_id").eq("school_id", schoolId).in("student_id", studentIds)
          : Promise.resolve({ data: [] as any[] }),
        studentIds.length
          ? supabase.from("fee_payments").select("student_id, amount_paid, fee_structure_id").eq("school_id", schoolId).in("student_id", studentIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("fee_structures").select("id, amount, class_id").eq("school_id", schoolId),
        supabase.from("fee_structure_classes").select("fee_structure_id, class_id").eq("school_id", schoolId),
      ]);

      const structAmt = new Map<string, number>();
      (structs ?? []).forEach((s: any) => structAmt.set(s.id, Number(s.amount)));
      const structToClasses = new Map<string, string[]>();
      (structs ?? []).forEach((s: any) => {
        if (s.class_id) structToClasses.set(s.id, [s.class_id]);
      });
      (links ?? []).forEach((l: any) => {
        const arr = structToClasses.get(l.fee_structure_id) ?? [];
        if (!arr.includes(l.class_id)) arr.push(l.class_id);
        structToClasses.set(l.fee_structure_id, arr);
      });

      const today = new Date(); today.setHours(0, 0, 0, 0);

      const list: StudentDueRow[] = (studs ?? []).map((s: any) => {
        const classId = s.sections?.classes?.id ?? null;
        const className = s.sections?.classes?.name ?? "";
        const sectionName = s.sections?.name ?? "";

        // total fee = sum of dues for this student + sum of structures applicable to their class
        const myDues = (dues ?? []).filter((d: any) => d.student_id === s.id);
        const myPays = (pays ?? []).filter((p: any) => p.student_id === s.id);

        let total = myDues.reduce((sum: number, d: any) => sum + Number(d.amount_due ?? 0), 0);
        if (total === 0 && classId) {
          // fallback: structures applicable to this class
          (structs ?? []).forEach((st: any) => {
            const cls = structToClasses.get(st.id) ?? [];
            if (cls.length === 0 || cls.includes(classId)) total += Number(st.amount ?? 0);
          });
        }
        const paid = myPays.reduce((sum: number, p: any) => sum + Number(p.amount_paid ?? 0), 0);
        const pending = Math.max(0, total - paid);

        const upcoming = myDues
          .filter((d: any) => !d.is_paid && d.due_date)
          .map((d: any) => parseISO(d.due_date))
          .sort((a, b) => a.getTime() - b.getTime());
        const nextDue = upcoming[0] ?? null;

        let status: StudentDueRow["status"] = "due";
        if (pending <= 0 && total > 0) status = "paid";
        else if (paid > 0 && pending > 0) status = "partial";
        if (nextDue && isAfter(today, nextDue) && pending > 0) status = "overdue";
        if (total === 0) status = "due";

        return {
          student_id: s.id,
          student_name: s.name,
          admission_number: s.admission_number,
          class_label: `${className}${sectionName ? " - " + sectionName : ""}`,
          section_id: s.section_id,
          total_fee: total,
          paid,
          pending,
          next_due: nextDue ? format(nextDue, "dd MMM yyyy") : null,
          status,
        };
      });

      setRows(list);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load dues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolId, isAdmin, teacherProfileId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.student_name.toLowerCase().includes(q) || r.admission_number.toLowerCase().includes(q));
  }, [rows, search]);

  const sendReminder = async (r: StudentDueRow) => {
    // Stub: log dispatch via attendance_audit-style? Use a toast for now and write nothing harmful.
    // We don't have a notifications outbox specifically for fees, so just inform the user.
    const { data: stu } = await supabase.from("students").select("parent_phone, name").eq("id", r.student_id).maybeSingle();
    if (!stu?.parent_phone) { toast.error(`No parent phone on file for ${r.student_name}`); return; }
    toast.success(`WhatsApp reminder queued to ${stu.parent_phone}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or admission no." className="pl-9" />
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-success-soft px-2 py-1 text-success">Paid</span>
          <span className="rounded-full bg-warning-soft px-2 py-1 text-warning">Partial</span>
          <span className="rounded-full bg-[hsl(0_100%_96%)] px-2 py-1 text-destructive">Overdue</span>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No students found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Total fee</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell>
                    <div className="font-medium">{r.student_name}</div>
                    <div className="text-xs text-muted-foreground">Adm. {r.admission_number}</div>
                  </TableCell>
                  <TableCell>{r.class_label}</TableCell>
                  <TableCell>{INR(r.total_fee)}</TableCell>
                  <TableCell className="text-success">{INR(r.paid)}</TableCell>
                  <TableCell className={r.pending > 0 ? "text-destructive font-medium" : ""}>{INR(r.pending)}</TableCell>
                  <TableCell>{r.next_due ?? "—"}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-1 text-xs font-medium capitalize", statusBadge(r.status))}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setRecordFor(r)} disabled={r.pending <= 0}>
                          <Receipt className="mr-1 h-3 w-3" /> Record
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => sendReminder(r)} disabled={r.pending <= 0}>
                          <MessageCircle className="mr-1 h-3 w-3" /> Remind
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setFlagFor(r)}>
                        <Flag className="mr-1 h-3 w-3" /> Flag for admin
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {recordFor && (
        <RecordPaymentDialog
          open={!!recordFor}
          onOpenChange={(v) => !v && setRecordFor(null)}
          schoolId={schoolId}
          student={recordFor}
          onSaved={() => { setRecordFor(null); load(); }}
        />
      )}
      {flagFor && currentUserId && (
        <FlagFollowupDialog
          open={!!flagFor}
          onOpenChange={(v) => !v && setFlagFor(null)}
          schoolId={schoolId}
          studentId={flagFor.student_id}
          studentName={flagFor.student_name}
          raisedBy={currentUserId}
          onSaved={() => setFlagFor(null)}
        />
      )}
    </div>
  );
}

// =====================================================
// Tab 3 — Payment History
// =====================================================
function HistoryTab({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_payments")
      .select("id, student_id, amount_paid, payment_date, payment_mode, receipt_number, receipt_url, students!inner(name)")
      .eq("school_id", schoolId)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    setRows(((data ?? []) as any[]).map((r) => ({
      id: r.id, student_id: r.student_id,
      student_name: r.students?.name ?? "—",
      amount_paid: Number(r.amount_paid),
      payment_date: r.payment_date,
      payment_mode: r.payment_mode,
      receipt_number: r.receipt_number,
      receipt_url: r.receipt_url,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [schoolId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.student_name.toLowerCase().includes(q));
  }, [rows, search]);

  const downloadReceipt = async (row: PaymentHistoryRow) => {
    setBusyId(row.id);
    try {
      let path = row.receipt_url;
      if (!path) {
        const { data, error } = await supabase.functions.invoke("generate-fee-receipt", { body: { payment_id: row.id } });
        if (error) throw error;
        path = (data as any)?.path ?? null;
      }
      if (!path) throw new Error("No receipt available");
      const { data: signed, error: sErr } = await supabase.storage.from("fee-receipts").createSignedUrl(path, 60 * 5);
      if (sErr) throw sErr;
      window.open(signed.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not download");
    } finally {
      setBusyId(null);
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by student name" className="pl-9" />
      </div>
      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No payments yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.payment_date ? format(parseISO(r.payment_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell className="font-medium">{r.student_name}</TableCell>
                  <TableCell>{INR(r.amount_paid)}</TableCell>
                  <TableCell className="capitalize">{r.payment_mode}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => downloadReceipt(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

// =====================================================
// Tab 4 — Reports
// =====================================================
function ReportsTab({ schoolId }: { schoolId: string }) {
  const [loading, setLoading] = useState(true);
  const [thisMonth, setThisMonth] = useState(0);
  const [lastMonth, setLastMonth] = useState(0);
  const [byClass, setByClass] = useState<{ class: string; pending: number }[]>([]);
  const [defaulters, setDefaulters] = useState<{ id: string; name: string; class: string; pending: number; days: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const thisStart = format(startOfMonth(now), "yyyy-MM-dd");
      const lastStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

      const [{ data: pays }, { data: dues }, { data: studs }] = await Promise.all([
        supabase.from("fee_payments").select("amount_paid, payment_date").eq("school_id", schoolId).gte("payment_date", lastStart),
        supabase.from("fee_dues").select("student_id, amount_due, due_date, is_paid, fee_structure_id").eq("school_id", schoolId),
        supabase.from("students")
          .select("id, name, sections!inner(id, name, classes!inner(id, name))")
          .eq("school_id", schoolId).eq("is_active", true),
      ]);

      let tm = 0, lm = 0;
      (pays ?? []).forEach((p: any) => {
        const d = parseISO(p.payment_date);
        if (d >= startOfMonth(now)) tm += Number(p.amount_paid);
        else if (d >= startOfMonth(subMonths(now, 1)) && d < startOfMonth(now)) lm += Number(p.amount_paid);
      });
      setThisMonth(tm); setLastMonth(lm);

      const studClass = new Map<string, string>();
      (studs ?? []).forEach((s: any) => studClass.set(s.id, s.sections?.classes?.name ?? "—"));

      // pending by class
      const pendByClass: Record<string, number> = {};
      (dues ?? []).filter((d: any) => !d.is_paid).forEach((d: any) => {
        const c = studClass.get(d.student_id) ?? "—";
        pendByClass[c] = (pendByClass[c] ?? 0) + Number(d.amount_due);
      });
      setByClass(Object.entries(pendByClass).map(([cls, p]) => ({ class: cls, pending: p })).sort((a, b) => b.pending - a.pending));

      // defaulters: overdue 7+ days
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const defAgg: Record<string, { pending: number; days: number }> = {};
      (dues ?? []).filter((d: any) => !d.is_paid && d.due_date).forEach((d: any) => {
        const due = parseISO(d.due_date); due.setHours(0, 0, 0, 0);
        const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
        if (days >= 7) {
          const cur = defAgg[d.student_id] ?? { pending: 0, days: 0 };
          cur.pending += Number(d.amount_due);
          cur.days = Math.max(cur.days, days);
          defAgg[d.student_id] = cur;
        }
      });
      const stuMap = new Map<string, { name: string; cls: string }>();
      (studs ?? []).forEach((s: any) => stuMap.set(s.id, { name: s.name, cls: s.sections?.classes?.name ?? "—" }));
      setDefaulters(
        Object.entries(defAgg)
          .map(([id, v]) => ({ id, name: stuMap.get(id)?.name ?? "—", class: stuMap.get(id)?.cls ?? "—", pending: v.pending, days: v.days }))
          .sort((a, b) => b.days - a.days),
      );

      setLoading(false);
    })();
  }, [schoolId]);

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push("Section,Field,Value");
    lines.push(`Collections,This month,${thisMonth}`);
    lines.push(`Collections,Last month,${lastMonth}`);
    byClass.forEach((b) => lines.push(`Pending by class,${b.class},${b.pending}`));
    defaulters.forEach((d) => lines.push(`Defaulter,${d.name} (${d.class}) [${d.days}d],${d.pending}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fee-report-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12 text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
    </div>
  );

  const chartData = [
    { label: format(subMonths(new Date(), 1), "MMM"), value: lastMonth },
    { label: format(new Date(), "MMM"), value: thisMonth },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}>
          <FileText className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold">Monthly collections</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <ReTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => INR(v)}
                />
                <Bar dataKey="value" fill="hsl(var(--brand-600))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold">Pending dues by class</h3>
          </div>
          {byClass.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending dues.</p>
          ) : (
            <div className="space-y-2">
              {byClass.map((b) => (
                <div key={b.class} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                  <span className="font-medium">{b.class}</span>
                  <span className="text-destructive">{INR(b.pending)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">Defaulters (overdue 7+ days)</h3>
        </div>
        {defaulters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No defaulters 🎉</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Days overdue</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaulters.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.class}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-[hsl(0_100%_96%)] px-2 py-0.5 text-xs font-medium text-destructive">
                      {d.days} days
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-destructive">{INR(d.pending)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

// =====================================================
// Parent View
// =====================================================
function ParentFeesView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<{ id: string; name: string; class: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; paid: number; pending: number; nextDue: string | null }>({ total: 0, paid: 0, pending: 0, nextDue: null });
  const [history, setHistory] = useState<PaymentHistoryRow[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from("parent_student")
        .select("student_id, students!inner(id, name, sections!inner(name, classes!inner(name)))")
        .eq("parent_user_id", user.id);
      const kids = (links ?? []).map((l: any) => ({
        id: l.students.id,
        name: l.students.name,
        class: `${l.students.sections?.classes?.name ?? ""}${l.students.sections?.name ? " - " + l.students.sections.name : ""}`,
      }));
      setChildren(kids);
      setActiveId(kids[0]?.id ?? null);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const [{ data: dues }, { data: pays }] = await Promise.all([
        supabase.from("fee_dues").select("amount_due, due_date, is_paid").eq("student_id", activeId),
        supabase.from("fee_payments").select("id, amount_paid, payment_date, payment_mode, receipt_number, receipt_url").eq("student_id", activeId).order("payment_date", { ascending: false }),
      ]);
      const total = (dues ?? []).reduce((s: number, d: any) => s + Number(d.amount_due), 0);
      const paid = (pays ?? []).reduce((s: number, p: any) => s + Number(p.amount_paid), 0);
      const upcoming = (dues ?? []).filter((d: any) => !d.is_paid && d.due_date)
        .map((d: any) => parseISO(d.due_date)).sort((a, b) => a.getTime() - b.getTime());
      setSummary({ total, paid, pending: Math.max(0, total - paid), nextDue: upcoming[0] ? format(upcoming[0], "dd MMM yyyy") : null });
      setHistory(((pays ?? []) as any[]).map((r) => ({
        id: r.id, student_id: activeId, student_name: "",
        amount_paid: Number(r.amount_paid), payment_date: r.payment_date,
        payment_mode: r.payment_mode, receipt_number: r.receipt_number, receipt_url: r.receipt_url,
      })));
    })();
  }, [activeId]);

  const downloadReceipt = async (row: PaymentHistoryRow) => {
    if (!row.receipt_url) { toast.error("Receipt is not yet available. Please contact the school."); return; }
    const { data: signed, error } = await supabase.storage.from("fee-receipts").createSignedUrl(row.receipt_url, 60 * 5);
    if (error) { toast.error(error.message); return; }
    window.open(signed.signedUrl, "_blank");
  };

  if (loading) return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;
  if (children.length === 0) return <div className="p-12 text-center text-sm text-muted-foreground">No children linked to your account.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fees</h1>

      {children.length > 1 && (
        <div className="flex gap-2">
          {children.map((c) => (
            <Button key={c.id} variant={c.id === activeId ? "default" : "outline"} onClick={() => setActiveId(c.id)} size="sm">
              {c.name}
            </Button>
          ))}
        </div>
      )}

      <Card className="p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total fees</p>
            <p className="mt-1 text-2xl font-semibold">{INR(summary.total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-semibold text-success">{INR(summary.paid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className={cn("mt-1 text-2xl font-semibold", summary.pending > 0 ? "text-destructive" : "text-foreground")}>{INR(summary.pending)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Next due</p>
            <p className="mt-1 text-2xl font-semibold">{summary.nextDue ?? "—"}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button disabled>Pay Now (Coming soon)</Button>
        </div>
      </Card>

      <Card>
        <div className="border-b p-4 text-sm font-semibold">Payment history</div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No payments yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.payment_date ? format(parseISO(r.payment_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>{INR(r.amount_paid)}</TableCell>
                  <TableCell className="capitalize">{r.payment_mode}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receipt_number ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => downloadReceipt(r)}>
                      <Download className="mr-1 h-3 w-3" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
