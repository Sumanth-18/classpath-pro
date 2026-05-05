import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BookLoader } from "@/components/BookLoader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "@/lib/toast";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sb: any = supabase;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6]; // ISO-like: Mon=1..Sat=6
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface Section { id: string; name: string; class_id: string; class_name: string; class_teacher_id: string | null; }
interface Subject { id: string; name: string; }
interface Teacher { id: string; name: string; }
interface Slot { id: string; day_of_week: number; period_number: number; subject_id: string | null; teacher_id: string | null; subject_name?: string; teacher_name?: string; }

export default function Timetable() {
  const { profile, school, role } = useAuth();
  const { activeChild } = useChild();
  const isAdmin = role === "school_admin";
  const isTeacher = role === "teacher";
  const isParent = role === "parent";

  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // edit dialog
  const [editCell, setEditCell] = useState<{ day: number; period: number } | null>(null);
  const [editSubject, setEditSubject] = useState<string>("");
  const [editTeacher, setEditTeacher] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load sections list (admin: all, teacher: own, parent: child's)
  useEffect(() => {
    if (!school?.id) return;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("sections")
        .select("id, name, class_id, class_teacher_id, classes!inner(name)")
        .eq("school_id", school.id);
      if (isTeacher && profile?.id) query = query.eq("class_teacher_id", profile.id);
      if (isParent && activeChild?.section_id) query = query.eq("id", activeChild.section_id);
      const { data } = await query.order("name");
      const list: Section[] = (data ?? []).map((s: any) => ({
        id: s.id, name: s.name, class_id: s.class_id,
        class_teacher_id: s.class_teacher_id, class_name: s.classes?.name ?? "",
      }));
      setSections(list);
      setSectionId(list[0]?.id ?? "");
      setLoading(false);
    })();
  }, [school?.id, profile?.id, role, activeChild?.section_id]);

  const currentSection = sections.find((s) => s.id === sectionId) ?? null;

  // Load timetable + subjects + teachers (admin only needs lookup lists)
  useEffect(() => {
    if (!school?.id || !sectionId || !currentSection) { setSlots([]); return; }
    (async () => {
      const [{ data: tt }, { data: subs }, { data: teachs }] = await Promise.all([
        supabase
          .from("timetable")
          .select("id, day_of_week, period_number, subject_id, teacher_id, subjects(name)")
          .eq("school_id", school.id)
          .eq("section_id", sectionId),
        supabase
          .from("subjects").select("id, name")
          .eq("school_id", school.id)
          .or(`class_id.eq.${currentSection.class_id},class_id.is.null`)
          .order("name"),
        isAdmin
          ? supabase.from("user_roles").select("user_id, profiles!inner(id, name)")
              .eq("school_id", school.id).eq("role", "teacher")
          : Promise.resolve({ data: [] }),
      ]);

      const teacherIds = Array.from(new Set((tt ?? []).map((r: any) => r.teacher_id).filter(Boolean)));
      let teacherMap = new Map<string, string>();
      if (teacherIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, name").in("id", teacherIds);
        (profs ?? []).forEach((p: any) => teacherMap.set(p.id, p.name));
      }

      const slotList: Slot[] = (tt ?? []).map((r: any) => ({
        id: r.id, day_of_week: r.day_of_week, period_number: r.period_number,
        subject_id: r.subject_id, teacher_id: r.teacher_id,
        subject_name: r.subjects?.name ?? null,
        teacher_name: r.teacher_id ? teacherMap.get(r.teacher_id) ?? null : null,
      }));
      setSlots(slotList);
      setSubjects((subs ?? []) as Subject[]);
      const tlist: Teacher[] = (teachs ?? []).map((r: any) => ({ id: r.profiles.id, name: r.profiles.name }));
      // dedupe
      const seen = new Set<string>();
      setTeachers(tlist.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))));
    })();
  }, [school?.id, sectionId, isAdmin, currentSection?.class_id]);

  const grid = useMemo(() => {
    const map = new Map<string, Slot>();
    slots.forEach((s) => map.set(`${s.day_of_week}-${s.period_number}`, s));
    return map;
  }, [slots]);

  const openEdit = (day: number, period: number) => {
    if (!isAdmin) return;
    const existing = grid.get(`${day}-${period}`);
    setEditCell({ day, period });
    setEditSubject(existing?.subject_id ?? "");
    setEditTeacher(existing?.teacher_id ?? "");
  };

  const saveCell = async () => {
    if (!editCell || !school?.id || !sectionId) return;
    setSaving(true);
    const existing = grid.get(`${editCell.day}-${editCell.period}`);
    const payload: any = {
      school_id: school.id,
      section_id: sectionId,
      day_of_week: editCell.day,
      period_number: editCell.period,
      subject_id: editSubject || null,
      teacher_id: editTeacher || null,
    };
    let error;
    if (existing) {
      ({ error } = await sb.from("timetable").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await sb.from("timetable").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Period saved");
    setEditCell(null);
    // refresh
    const { data: tt } = await supabase
      .from("timetable")
      .select("id, day_of_week, period_number, subject_id, teacher_id, subjects(name)")
      .eq("school_id", school.id).eq("section_id", sectionId);
    const teacherIds = Array.from(new Set((tt ?? []).map((r: any) => r.teacher_id).filter(Boolean)));
    let teacherMap = new Map<string, string>();
    if (teacherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, name").in("id", teacherIds);
      (profs ?? []).forEach((p: any) => teacherMap.set(p.id, p.name));
    }
    setSlots((tt ?? []).map((r: any) => ({
      id: r.id, day_of_week: r.day_of_week, period_number: r.period_number,
      subject_id: r.subject_id, teacher_id: r.teacher_id,
      subject_name: r.subjects?.name ?? null,
      teacher_name: r.teacher_id ? teacherMap.get(r.teacher_id) ?? null : null,
    })));
  };

  const clearCell = async () => {
    if (!editCell) return;
    const existing = grid.get(`${editCell.day}-${editCell.period}`);
    if (!existing) { setEditCell(null); return; }
    setSaving(true);
    const { error } = await sb.from("timetable").delete().eq("id", existing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Period cleared");
    setSlots((prev) => prev.filter((s) => s.id !== existing.id));
    setEditCell(null);
  };

  if (loading) return <BookLoader label="Loading timetable…" />;

  if (sections.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={Clock}
          title={isParent ? "No section assigned" : isTeacher ? "No section assigned" : "No sections yet"}
          description={isParent
            ? "Your child is not assigned to a section yet."
            : isTeacher
              ? "You're not assigned as a class teacher yet."
              : "Create classes and sections to build a timetable."}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Tap any cell to assign a subject and teacher." : "Weekly class schedule."}
          </p>
        </div>
        {isAdmin && (
          <div className="w-56">
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.class_name} - {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isAdmin && currentSection && (
          <div className="text-sm font-medium text-muted-foreground">
            {currentSection.class_name} - {currentSection.name}
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40">
                <th className="p-2 text-left text-xs font-medium text-muted-foreground border-b border-border w-20">Period</th>
                {DAYS.map((d) => (
                  <th key={d} className="p-2 text-left text-xs font-medium text-muted-foreground border-b border-border min-w-[140px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p} className="border-b border-border last:border-b-0">
                  <td className="p-2 font-semibold text-xs text-muted-foreground">P{p}</td>
                  {DAY_INDEX.map((d) => {
                    const cell = grid.get(`${d}-${p}`);
                    return (
                      <td
                        key={d}
                        onClick={() => openEdit(d, p)}
                        className={cn(
                          "p-2 align-top border-l border-border h-16",
                          isAdmin && "cursor-pointer hover:bg-muted/40 transition-colors",
                        )}
                      >
                        {cell ? (
                          <div>
                            <div className="text-sm font-medium">{cell.subject_name ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground">{cell.teacher_name ?? "—"}</div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground/60">{isAdmin ? "Tap to assign" : "—"}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!editCell} onOpenChange={(o) => !o && setEditCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign period</DialogTitle>
            <DialogDescription>
              {editCell && `${DAYS[editCell.day - 1]} · Period ${editCell.period}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Subject</Label>
              <Select value={editSubject} onValueChange={setEditSubject}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Teacher</Label>
              <Select value={editTeacher} onValueChange={setEditTeacher}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row sm:justify-between">
            <Button variant="ghost" onClick={clearCell} disabled={saving} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" /> Clear
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditCell(null)} disabled={saving}>Cancel</Button>
              <Button onClick={saveCell} disabled={saving} className="bg-gradient-brand hover:opacity-95">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
