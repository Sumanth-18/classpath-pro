import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isBefore } from "date-fns";
import { ClipboardList } from "lucide-react";
import toast from "react-hot-toast";

const sb: any = supabase;

interface Assn {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  subject_id: string | null;
  subjects: { name: string } | null;
}

export default function ParentHomework() {
  const { school } = useAuth();
  const { activeChild } = useChild();
  const [items, setItems] = useState<Assn[]>([]);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeChild?.section_id || !school?.id) { setItems([]); return; }
    (async () => {
      const [{ data: assns }, { data: subs }] = await Promise.all([
        supabase.from("assignments")
          .select("id, title, description, due_date, subject_id, subjects(name)")
          .eq("school_id", school.id)
          .eq("section_id", activeChild.section_id!)
          .order("due_date", { ascending: false, nullsFirst: false }),
        sb.from("homework_submissions")
          .select("assignment_id, marked_done_by_parent")
          .eq("student_id", activeChild.id),
      ]);
      setItems((assns ?? []) as any);
      const m: Record<string, boolean> = {};
      (subs ?? []).forEach((r: any) => { m[r.assignment_id] = !!r.marked_done_by_parent; });
      setDoneMap(m);
    })();
  }, [activeChild?.section_id, activeChild?.id, school?.id]);

  const toggle = async (assignmentId: string, val: boolean) => {
    if (!activeChild?.id) return;
    setDoneMap((p) => ({ ...p, [assignmentId]: val }));
    const { error } = await sb.from("homework_submissions").upsert(
      {
        assignment_id: assignmentId,
        student_id: activeChild.id,
        marked_done_by_parent: val,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" }
    );
    if (error) {
      toast.error(error.message);
      setDoneMap((p) => ({ ...p, [assignmentId]: !val }));
    }
  };

  if (!activeChild) return <div className="p-12 text-center text-sm text-muted-foreground">No child selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Homework</h1>
        <p className="text-sm text-muted-foreground">{activeChild.name} · {activeChild.classLabel}</p>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">No assignments yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const done = !!doneMap[a.id];
            const overdue = a.due_date && isBefore(parseISO(a.due_date), new Date()) && !done;
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-info-soft flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-info" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-sm font-semibold">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.subjects?.name ?? "—"}
                          {a.due_date && <> · Due {format(parseISO(a.due_date), "dd MMM")}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {overdue && <Badge variant="destructive">Overdue</Badge>}
                        {done && <Badge className="bg-success text-white">Done</Badge>}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Mark done</span>
                          <Switch checked={done} onCheckedChange={(v) => toggle(a.id, v)} />
                        </div>
                      </div>
                    </div>
                    {a.description && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{a.description}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
