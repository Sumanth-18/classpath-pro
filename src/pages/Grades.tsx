import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookLoader } from "@/components/BookLoader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/lib/toast";
import { BookOpen, Save, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Section { id: string; name: string; class_id: string; class_name: string; class_teacher_id: string | null; }
interface Exam { id: string; name: string; class_id: string | null; published: boolean; }
interface Subject { id: string; name: string; max_marks: number; }
interface Student { id: string; name: string; admission_number: string; }
interface MarkRow { id?: string; student_id: string; subject_id: string; marks_obtained: number | null; max_marks: number; }

const sb: any = supabase;

export default function Grades() {
  const { profile, school, role } = useAuth();
  const isAdmin = role === "school_admin";
  const isTeacher = role === "teacher";

  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  // map: `${student_id}|${subject_id}` -> MarkRow
  const [marksMap, setMarksMap] = useState<Record<string, MarkRow>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);

  const currentSection = sections.find((s) => s.id === sectionId) ?? null;
  const currentExam = exams.find((e) => e.id === examId) ?? null;
  const classId = currentSection?.class_id ?? null;

  // Load sections (admin = all, teacher = own only)
  useEffect(() => {
    if (!school?.id || !profile?.id) return;
    (async () => {
      setLoadingMeta(true);
      let q = supabase
        .from("sections")
        .select("id, name, class_id, class_teacher_id, classes!inner(name)")
        .eq("school_id", school.id);
      if (isTeacher) q = q.eq("class_teacher_id", profile.id);
      const { data } = await q.order("name");
      const list: Section[] = (data ?? []).map((s: any) => ({
        id: s.id, name: s.name, class_id: s.class_id,
        class_teacher_id: s.class_teacher_id,
        class_name: s.classes?.name ?? "",
      }));
      setSections(list);
      if (list.length && !sectionId) setSectionId(list[0].id);
      setLoadingMeta(false);
    })();
  }, [school?.id, profile?.id, isTeacher]);

  // Load exams for selected class
  useEffect(() => {
    if (!school?.id || !classId) { setExams([]); setExamId(""); return; }
    (async () => {
      const { data } = await supabase
        .from("exams")
        .select("id, name, class_id, published")
        .eq("school_id", school.id)
        .or(`class_id.eq.${classId},class_id.is.null`)
        .order("start_date", { ascending: false });
      const list = (data ?? []) as Exam[];
      setExams(list);
      setExamId(list[0]?.id ?? "");
    })();
  }, [school?.id, classId]);

  // Load subjects + students + existing marks for grid
  useEffect(() => {
    if (!school?.id || !sectionId || !examId || !classId) {
      setSubjects([]); setStudents([]); setMarksMap({}); return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGrid(true);
      const [{ data: subs }, { data: studs }, { data: existing }] = await Promise.all([
        supabase.from("subjects").select("id, name, max_marks")
          .eq("school_id", school.id)
          .or(`class_id.eq.${classId},class_id.is.null`)
          .order("name"),
        supabase.from("students").select("id, name, admission_number")
          .eq("school_id", school.id)
          .eq("section_id", sectionId)
          .eq("is_active", true)
          .order("name"),
        supabase.from("marks").select("id, student_id, subject_id, marks_obtained, max_marks")
          .eq("school_id", school.id)
          .eq("exam_id", examId),
      ]);
      if (cancelled) return;
      const subjList: Subject[] = (subs ?? []).map((s: any) => ({
        id: s.id, name: s.name, max_marks: Number(s.max_marks ?? 100),
      }));
      const studList = (studs ?? []) as Student[];
      const map: Record<string, MarkRow> = {};
      // seed all cells (so editing creates a row)
      studList.forEach((st) => subjList.forEach((sub) => {
        map[`${st.id}|${sub.id}`] = {
          student_id: st.id, subject_id: sub.id,
          marks_obtained: null, max_marks: sub.max_marks,
        };
      }));
      (existing ?? []).forEach((m: any) => {
        const key = `${m.student_id}|${m.subject_id}`;
        if (map[key]) map[key] = {
          id: m.id, student_id: m.student_id, subject_id: m.subject_id,
          marks_obtained: m.marks_obtained == null ? null : Number(m.marks_obtained),
          max_marks: Number(m.max_marks ?? map[key].max_marks),
        };
      });
      setSubjects(subjList);
      setStudents(studList);
      setMarksMap(map);
      setSavedAt(null);
      setLoadingGrid(false);
    })();
    return () => { cancelled = true; };
  }, [school?.id, sectionId, examId, classId]);

  const setCell = (studentId: string, subjectId: string, raw: string) => {
    const key = `${studentId}|${subjectId}`;
    setMarksMap((prev) => {
      const cell = prev[key];
      if (!cell) return prev;
      const value = raw.trim() === "" ? null : Number(raw);
      return { ...prev, [key]: { ...cell, marks_obtained: Number.isFinite(value as number) ? (value as number) : null } };
    });
  };

  const overflowKeys = useMemo(() => {
    const bad: string[] = [];
    Object.entries(marksMap).forEach(([k, v]) => {
      if (v.marks_obtained != null && v.marks_obtained > v.max_marks) bad.push(k);
      if (v.marks_obtained != null && v.marks_obtained < 0) bad.push(k);
    });
    return new Set(bad);
  }, [marksMap]);

  const hasErrors = overflowKeys.size > 0;

  const save = async () => {
    if (!school?.id || !examId || !profile?.id) return;
    if (hasErrors) { toast.error("Fix highlighted cells before saving"); return; }
    setSaving(true);
    const rows = Object.values(marksMap)
      .filter((m) => m.marks_obtained != null)
      .map((m) => ({
        school_id: school.id,
        exam_id: examId,
        student_id: m.student_id,
        subject_id: m.subject_id,
        marks_obtained: m.marks_obtained,
        max_marks: m.max_marks,
        entered_by: profile.id,
      }));
    if (rows.length === 0) {
      setSaving(false);
      toast.info("Nothing to save");
      return;
    }
    const { error } = await sb.from("marks").upsert(rows, {
      onConflict: "student_id,exam_id,subject_id",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date());
    toast.success(`Saved ${rows.length} marks`);
  };

  const togglePublish = async (next: boolean) => {
    if (!currentExam || !isAdmin) return;
    setPublishing(true);
    const { error } = await supabase.from("exams").update({ published: next }).eq("id", currentExam.id);
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    setExams((prev) => prev.map((e) => e.id === currentExam.id ? { ...e, published: next } : e));
    toast.success(next ? "Exam published — visible to parents" : "Exam unpublished");
  };

  if (loadingMeta) return <BookLoader label="Loading grade book…" />;

  if (sections.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={BookOpen}
          title={isTeacher ? "No section assigned" : "No sections yet"}
          description={isTeacher
            ? "You're not currently assigned as a class teacher. Ask your administrator to assign you to a section."
            : "Create classes and sections first to start entering marks."}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grade Book</h1>
          <p className="text-sm text-muted-foreground">Enter and publish exam marks for your students.</p>
        </div>
        {savedAt && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Last saved {formatDistanceToNow(savedAt, { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Selectors */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Section</label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.class_name} - {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isTeacher && currentSection && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Section</label>
              <div className="h-11 rounded-xl border border-border bg-muted/40 px-3 flex items-center text-sm font-medium">
                {currentSection.class_name} - {currentSection.name}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Exam</label>
            <div className="flex items-center gap-2">
              <Select value={examId} onValueChange={setExamId} disabled={exams.length === 0}>
                <SelectTrigger className="rounded-xl h-11 flex-1">
                  <SelectValue placeholder={exams.length ? "Select exam" : "No exams"} />
                </SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentExam?.published && (
                <Badge className="bg-success text-success-foreground hover:bg-success">Published</Badge>
              )}
            </div>
          </div>
        </div>

        {isAdmin && currentExam && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Publish to parents</div>
              <div className="text-xs text-muted-foreground">When on, parents can view marks for this exam in their portal.</div>
            </div>
            <div className="flex items-center gap-2">
              {publishing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch checked={currentExam.published} onCheckedChange={togglePublish} disabled={publishing} />
            </div>
          </div>
        )}
      </Card>

      {/* Grid */}
      <Card className="overflow-hidden">
        {loadingGrid ? (
          <BookLoader label="Loading marks…" />
        ) : !examId ? (
          <div className="p-6">
            <EmptyState icon={BookOpen} title="No exam selected" description="Pick an exam above to start entering marks." />
          </div>
        ) : students.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={BookOpen} title="No students" description="This section has no active students." />
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={BookOpen} title="No subjects" description="Add subjects for this class first." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card min-w-[180px]">Student</TableHead>
                  {subjects.map((sub) => (
                    <TableHead key={sub.id} className="text-center min-w-[110px]">
                      <div className="font-semibold">{sub.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">max {sub.max_marks}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((st) => (
                  <TableRow key={st.id}>
                    <TableCell className="sticky left-0 bg-card font-medium">
                      <div>{st.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{st.admission_number}</div>
                    </TableCell>
                    {subjects.map((sub) => {
                      const key = `${st.id}|${sub.id}`;
                      const cell = marksMap[key];
                      const overflow = overflowKeys.has(key);
                      return (
                        <TableCell key={sub.id} className="text-center">
                          <Input
                            type="number"
                            min={0}
                            max={sub.max_marks}
                            inputMode="decimal"
                            value={cell?.marks_obtained ?? ""}
                            onChange={(e) => setCell(st.id, sub.id, e.target.value)}
                            className={cn(
                              "h-9 w-20 mx-auto text-center rounded-lg",
                              overflow && "border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive",
                            )}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {hasErrors
            ? <span className="text-destructive font-medium">Some cells exceed max marks. Fix them to save.</span>
            : "Empty cells are skipped on save."}
        </div>
        <Button
          onClick={save}
          disabled={saving || hasErrors || !examId || students.length === 0}
          className="rounded-xl bg-gradient-brand hover:opacity-95"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save marks
        </Button>
      </div>
    </div>
  );
}
