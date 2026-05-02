import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { StaffRow } from "@/pages/Staff";

interface Section {
  id: string;
  name: string;
  classes: { name: string } | null;
}

interface Subject {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  teacher: StaffRow | null;
}

export function TeacherAssignmentsDialog({ open, onOpenChange, schoolId, teacher }: Props) {
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // key: `${section_id}|${subject_id ?? ""}`
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !teacher) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: secs }, { data: subs }, { data: existing }] = await Promise.all([
        supabase.from("sections").select("id, name, classes (name)").eq("school_id", schoolId).order("name"),
        supabase.from("subjects").select("id, name").eq("school_id", schoolId).order("name"),
        supabase
          .from("teacher_assignments")
          .select("section_id, subject_id")
          .eq("school_id", schoolId)
          .eq("teacher_id", teacher.profile_id),
      ]);
      if (cancelled) return;
      setSections((secs as any) ?? []);
      setSubjects((subs as any) ?? []);
      const set = new Set<string>();
      (existing ?? []).forEach((a: any) => set.add(`${a.section_id}|${a.subject_id ?? ""}`));
      setSelected(set);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [open, teacher, schoolId]);

  const toggle = (sectionId: string, subjectId: string) => {
    const key = `${sectionId}|${subjectId}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const save = async () => {
    if (!teacher) return;
    setSaving(true);
    // Replace strategy: delete all existing, insert new selections
    await supabase
      .from("teacher_assignments")
      .delete()
      .eq("school_id", schoolId)
      .eq("teacher_id", teacher.profile_id);
    const inserts = Array.from(selected).map((key) => {
      const [section_id, subject_id] = key.split("|");
      return {
        school_id: schoolId,
        teacher_id: teacher.profile_id,
        section_id,
        subject_id: subject_id || null,
      };
    });
    if (inserts.length > 0) {
      const { error } = await supabase.from("teacher_assignments").insert(inserts);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
    }
    setSaving(false);
    toast.success("Assignments saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Assign subjects & sections {teacher ? `· ${teacher.name}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sections.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No sections set up yet. Create classes & sections first.
          </div>
        ) : subjects.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No subjects configured. Add subjects in the Academics section first.
          </div>
        ) : (
          <div className="rounded-xl border border-border max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Section ↓ / Subject →</th>
                  {subjects.map((s) => (
                    <th key={s.id} className="px-3 py-2 text-center font-semibold">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => (
                  <tr key={sec.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">
                      {sec.classes?.name}-{sec.name}
                    </td>
                    {subjects.map((subj) => {
                      const key = `${sec.id}|${subj.id}`;
                      return (
                        <td key={subj.id} className="px-3 py-2 text-center">
                          <Checkbox
                            checked={selected.has(key)}
                            onCheckedChange={() => toggle(sec.id, subj.id)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl bg-gradient-brand"
            disabled={saving || loading}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
