import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, FileDown, AlertCircle, CheckCircle2, X } from "lucide-react";
import toast from "react-hot-toast";

interface SectionLite {
  id: string;
  name: string;
  classes: { name: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  sections: SectionLite[];
  onImported: () => void;
}

interface ParsedRow {
  name: string;
  admission_number: string;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  section_id: string | null;
  _classSection: string;
  _error?: string;
}

const TEMPLATE = `name,admission_number,class_section,gender,date_of_birth
Aarav Kumar,SS101,5-A,male,2014-05-12
Diya Sharma,SS102,5-A,female,2014-08-03
Rohan Patel,SS103,6-B,male,2013-11-21`;

function normalizeGender(g: string): "male" | "female" | "other" | null {
  const v = g?.trim().toLowerCase();
  if (v === "male" || v === "m") return "male";
  if (v === "female" || v === "f") return "female";
  if (v === "other" || v === "o") return "other";
  return null;
}

function normalizeDate(d: string): string | null {
  if (!d?.trim()) return null;
  const trimmed = d.trim();
  // Accept YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

export function ImportStudentsDialog({ open, onOpenChange, schoolId, sections, onImported }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sectionMap = useMemo(() => {
    const map = new Map<string, string>();
    sections.forEach((s) => {
      const key = `${s.classes?.name ?? ""}-${s.name}`.toLowerCase();
      map.set(key, s.id);
      map.set(`${s.classes?.name ?? ""}${s.name}`.toLowerCase(), s.id);
    });
    return map;
  }, [sections]);

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;

  const reset = () => {
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);

    // Fetch existing admission numbers in this school for duplicate detection
    const { data: existing } = await supabase
      .from("students")
      .select("admission_number")
      .eq("school_id", schoolId);
    const existingSet = new Set(
      (existing ?? []).map((s) => s.admission_number.toLowerCase())
    );

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const seen = new Set<string>();
        const parsed: ParsedRow[] = result.data.map((raw) => {
          const name = (raw.name ?? "").trim();
          const admission_number = (raw.admission_number ?? raw["admission_no"] ?? "").trim();
          const classSection = (raw.class_section ?? raw["class"] ?? "").trim();
          const gender = normalizeGender(raw.gender ?? "");
          const date_of_birth = normalizeDate(raw.date_of_birth ?? raw["dob"] ?? "");
          const section_id = sectionMap.get(classSection.toLowerCase()) ?? null;

          let error: string | undefined;
          const admLower = admission_number.toLowerCase();
          if (!name) error = "Name required";
          else if (!admission_number) error = "Admission # required";
          else if (seen.has(admLower)) error = "Duplicate adm# in file";
          else if (existingSet.has(admLower)) error = "Adm# already exists in school";
          else if (classSection && !section_id) error = `Unknown section "${classSection}"`;
          seen.add(admLower);

          return {
            name, admission_number, gender, date_of_birth, section_id,
            _classSection: classSection, _error: error,
          };
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
    a.href = url;
    a.download = "students-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => !r._error);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setSubmitting(true);
    const payload = valid.map((r) => ({
      school_id: schoolId,
      name: r.name,
      admission_number: r.admission_number,
      gender: r.gender,
      date_of_birth: r.date_of_birth,
      section_id: r.section_id,
    }));
    const { error } = await supabase.from("students").insert(payload);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        toast.error("Some admission numbers already exist in the school. Please re-upload after fixing.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(`Imported ${valid.length} student${valid.length === 1 ? "" : "s"}!`);
    reset();
    onOpenChange(false);
    onImported();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Bulk import students</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template + upload zone */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-1.5" /> Download CSV template
            </Button>
            <span className="text-xs text-muted-foreground">
              Columns: name, admission_number, class_section, gender, date_of_birth
            </span>
          </div>

          <label className="block">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition cursor-pointer p-6 text-center">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
              <div className="text-sm font-medium">
                {fileName || "Click to choose a CSV file"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {fileName ? "Click again to choose another" : "Max ~1000 rows recommended"}
              </div>
            </div>
          </label>

          {/* Preview */}
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
                      <th className="px-3 py-2">Adm#</th>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Gender</th>
                      <th className="px-3 py-2">DOB</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r._error ? "bg-destructive/5" : ""}`}>
                        <td className="px-3 py-1.5">{r.name || "—"}</td>
                        <td className="px-3 py-1.5 font-mono">{r.admission_number || "—"}</td>
                        <td className="px-3 py-1.5">{r._classSection || "—"}</td>
                        <td className="px-3 py-1.5">{r.gender ?? "—"}</td>
                        <td className="px-3 py-1.5">{r.date_of_birth ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          {r._error ? (
                            <span className="text-destructive">{r._error}</span>
                          ) : (
                            <span className="text-success">Ready</span>
                          )}
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
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl bg-gradient-brand"
            disabled={submitting || validCount === 0}
            onClick={handleImport}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Import ${validCount} student${validCount === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
