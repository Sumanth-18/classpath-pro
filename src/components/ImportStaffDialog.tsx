import { useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, FileDown, AlertCircle, CheckCircle2, X } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  role: "teacher" | "school_admin";
  designation: string;
  department: string;
  employee_id: string;
  date_of_joining: string | null;
  salary: number | null;
  _error?: string;
}

const TEMPLATE = `name,email,phone,role,designation,department,employee_id,date_of_joining,salary
Anita Verma,anita@school.com,9876543210,teacher,Math Teacher,Teaching,EMP-001,2022-06-01,38000
Rajesh Kumar,rajesh@school.com,9123456780,school_admin,Vice Principal,Administration,EMP-002,2020-04-15,75000
Priya Nair,priya@school.com,9988776655,teacher,Librarian,Library,EMP-003,2023-07-10,28000`;

function normalizeRole(r: string): "teacher" | "school_admin" {
  const v = (r ?? "").trim().toLowerCase();
  if (v === "admin" || v === "school_admin" || v === "principal") return "school_admin";
  return "teacher";
}

function normalizeDate(d: string): string | null {
  if (!d?.trim()) return null;
  const t = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

export function ImportStaffDialog({ open, onOpenChange, schoolId, onImported }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;

  const reset = () => {
    setRows([]); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);

    // Pre-fetch existing emails + employee IDs in this school for duplicate detection
    const { data: existing } = await supabase
      .from("profiles")
      .select("email")
      .eq("school_id", schoolId);
    const existingEmails = new Set(
      (existing ?? []).map((p: any) => (p.email ?? "").toLowerCase()).filter(Boolean)
    );
    const { data: existingStaff } = await supabase
      .from("staff_profiles")
      .select("employee_id")
      .eq("school_id", schoolId);
    const existingEmpIds = new Set(
      (existingStaff ?? [])
        .map((s: any) => (s.employee_id ?? "").toLowerCase())
        .filter(Boolean)
    );

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const seen = new Set<string>();
        const seenEmpIds = new Set<string>();
        const parsed: ParsedRow[] = result.data.map((raw) => {
          const name = (raw.name ?? "").trim();
          const email = (raw.email ?? "").trim().toLowerCase();
          const phone = (raw.phone ?? "").trim();
          const role = normalizeRole(raw.role ?? "");
          const designation = (raw.designation ?? "").trim();
          const department = (raw.department ?? "").trim() || "Teaching";
          const employee_id = (raw.employee_id ?? raw["emp_id"] ?? "").trim();
          const empIdLower = employee_id.toLowerCase();
          const date_of_joining = normalizeDate(raw.date_of_joining ?? raw["doj"] ?? "");
          const salaryRaw = (raw.salary ?? "").trim();
          const salary = salaryRaw ? Number(salaryRaw) : null;

          let error: string | undefined;
          if (!name) error = "Name required";
          else if (!email) error = "Email required";
          else if (!/^\S+@\S+\.\S+$/.test(email)) error = "Invalid email";
          else if (seen.has(email)) error = "Duplicate email in file";
          else if (existingEmails.has(email)) error = "Email already exists in school";
          else if (employee_id && seenEmpIds.has(empIdLower)) error = "Duplicate employee ID in file";
          else if (employee_id && existingEmpIds.has(empIdLower)) error = "Employee ID already exists in school";
          else if (salary !== null && Number.isNaN(salary)) error = "Invalid salary";
          seen.add(email);
          if (employee_id) seenEmpIds.add(empIdLower);

          return { name, email, phone, role, designation, department, employee_id, date_of_joining, salary, _error: error };
        });
        setRows(parsed);
        if (parsed.length === 0) toast.error("No rows found in CSV");
      },
      error: (err) => toast.error(`Failed to parse: ${err.message}`),
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "staff-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => !r._error);
    if (valid.length === 0) { toast.error("No valid rows to import"); return; }
    setSubmitting(true);

    let successes = 0;
    const failures: { email: string; reason: string }[] = [];

    // Sequential to avoid hammering auth admin API
    for (const r of valid) {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          name: r.name,
          email: r.email,
          phone: r.phone || null,
          role: r.role,
          school_id: schoolId,
          designation: r.designation || null,
          department: r.department || null,
          employee_id: r.employee_id || null,
          date_of_joining: r.date_of_joining,
          salary: r.salary,
        },
      });
      const err = (data as any)?.error ?? error?.message;
      if (err) failures.push({ email: r.email, reason: err });
      else successes++;
    }

    setSubmitting(false);
    if (failures.length === 0) {
      toast.success(`Invited ${successes} staff member${successes === 1 ? "" : "s"}!`);
      reset();
      onOpenChange(false);
    } else {
      toast.error(`${successes} invited · ${failures.length} failed`);
      console.warn("Import failures:", failures);
    }
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Bulk import staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-1.5" /> Download CSV template
            </Button>
            <span className="text-xs text-muted-foreground">
              Columns: name, email, phone, role, designation, department, employee_id, date_of_joining, salary
            </span>
          </div>

          <label className="block">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition cursor-pointer p-6 text-center">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
              <div className="text-sm font-medium">{fileName || "Click to choose a CSV file"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {fileName ? "Click again to choose another" : "Max ~500 rows recommended"}
              </div>
            </div>
          </label>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {validCount} valid
                </span>
                {errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> {errorCount} with errors
                  </span>
                )}
                <button onClick={reset} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Dept.</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r._error ? "bg-destructive/5" : ""}`}>
                        <td className="px-3 py-1.5">{r.name || "—"}</td>
                        <td className="px-3 py-1.5">{r.email || "—"}</td>
                        <td className="px-3 py-1.5 capitalize">{r.role.replace("_", " ")}</td>
                        <td className="px-3 py-1.5">{r.department || "—"}</td>
                        <td className="px-3 py-1.5">
                          {r._error
                            ? <span className="text-destructive">{r._error}</span>
                            : <span className="text-success">Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <div className="text-center text-[11px] text-muted-foreground py-2 bg-muted/20">
                    Showing first 100 of {rows.length} rows
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="rounded-xl bg-gradient-brand"
            disabled={submitting || validCount === 0}
            onClick={handleImport}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${validCount} staff`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
