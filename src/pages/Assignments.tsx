import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BookLoader } from "@/components/BookLoader";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon, ClipboardList, Plus, Pencil, Trash2, Paperclip, Loader2, ExternalLink,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const sb: any = supabase;

type AssignmentType = "homework" | "classwork" | "project";

interface Section { id: string; name: string; class_id: string; class_name: string; class_teacher_id: string | null; }
interface Subject { id: string; name: string; }
interface Row {
  id: string;
  title: string;
  description: string | null;
  assignment_type: AssignmentType;
  due_date: string | null;
  subject_id: string | null;
  section_id: string | null;
  created_by: string | null;
  file_url: string | null;
  subject_name?: string | null;
  section_name?: string | null;
  class_name?: string | null;
  teacher_name?: string | null;
  done_count?: number;
  total_count?: number;
}

export default function Assignments() {
  const { profile, school, role } = useAuth();
  const isAdmin = role === "school_admin";
  const isTeacher = role === "teacher";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [section, setSection] = useState<Section | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [type, setType] = useState<AssignmentType>("homework");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // delete
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  const load = async () => {
    if (!school?.id) return;
    setLoading(true);

    let teacherSection: Section | null = null;
    let subjectsList: Subject[] = [];

    if (isTeacher && profile?.id) {
      const { data: secs } = await supabase
        .from("sections")
        .select("id, name, class_id, class_teacher_id, classes!inner(name)")
        .eq("school_id", school.id)
        .eq("class_teacher_id", profile.id)
        .limit(1);
      const s = secs?.[0] as any;
      if (s) {
        teacherSection = {
          id: s.id, name: s.name, class_id: s.class_id,
          class_teacher_id: s.class_teacher_id, class_name: s.classes?.name ?? "",
        };
        const { data: subs } = await supabase
          .from("subjects").select("id, name")
          .eq("school_id", school.id)
          .or(`class_id.eq.${s.class_id},class_id.is.null`)
          .order("name");
        subjectsList = (subs ?? []) as Subject[];
      }
    }
    setSection(teacherSection);
    setSubjects(subjectsList);

    // Load assignments
    let q = supabase
      .from("assignments")
      .select("id, title, description, assignment_type, due_date, subject_id, section_id, created_by, file_url, subjects(name), sections(name, classes(name))")
      .eq("school_id", school.id)
      .order("due_date", { ascending: false, nullsFirst: false });

    if (isTeacher && profile?.id) q = q.eq("created_by", profile.id);

    const { data: arows } = await q;
    const list: Row[] = (arows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      assignment_type: r.assignment_type,
      due_date: r.due_date,
      subject_id: r.subject_id,
      section_id: r.section_id,
      created_by: r.created_by,
      file_url: r.file_url,
      subject_name: r.subjects?.name ?? null,
      section_name: r.sections?.name ?? null,
      class_name: r.sections?.classes?.name ?? null,
    }));

    // Admin: hydrate teacher names
    if (isAdmin && list.length) {
      const creatorIds = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean) as string[]));
      if (creatorIds.length) {
        const { data: profs } = await supabase
          .from("profiles").select("user_id, name").in("user_id", creatorIds);
        const nameMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.name]));
        list.forEach((r) => { r.teacher_name = r.created_by ? nameMap.get(r.created_by) ?? null : null; });
      }
    }

    // Counts: students per section + done submissions per assignment
    const sectionIds = Array.from(new Set(list.map((r) => r.section_id).filter(Boolean) as string[]));
    const totals: Record<string, number> = {};
    if (sectionIds.length) {
      const { data: studs } = await supabase
        .from("students").select("id, section_id")
        .eq("school_id", school.id).eq("is_active", true).in("section_id", sectionIds);
      (studs ?? []).forEach((s: any) => {
        if (s.section_id) totals[s.section_id] = (totals[s.section_id] ?? 0) + 1;
      });
    }
    const ids = list.map((r) => r.id);
    const dones: Record<string, number> = {};
    if (ids.length) {
      const { data: subs } = await supabase
        .from("homework_submissions")
        .select("assignment_id")
        .eq("marked_done_by_parent", true)
        .in("assignment_id", ids);
      (subs ?? []).forEach((s: any) => {
        dones[s.assignment_id] = (dones[s.assignment_id] ?? 0) + 1;
      });
    }
    list.forEach((r) => {
      r.total_count = r.section_id ? (totals[r.section_id] ?? 0) : 0;
      r.done_count = dones[r.id] ?? 0;
    });

    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id, profile?.id, role]);

  const openCreate = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setSubjectId("");
    setType("homework"); setDueDate(undefined); setFile(null);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditing(r);
    setTitle(r.title);
    setDescription(r.description ?? "");
    setSubjectId(r.subject_id ?? "");
    setType(r.assignment_type);
    setDueDate(r.due_date ? new Date(r.due_date) : undefined);
    setFile(null);
    setOpen(true);
  };

  const save = async () => {
    if (!school?.id || !profile?.id || !section) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);

    let file_url: string | null = editing?.file_url ?? null;
    if (file) {
      const path = `${school.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("assignment-files").upload(path, file, { upsert: false });
      if (upErr) { setSaving(false); toast.error(upErr.message); return; }
      file_url = supabase.storage.from("assignment-files").getPublicUrl(path).data.publicUrl;
    }

    const payload: any = {
      school_id: school.id,
      section_id: section.id,
      subject_id: subjectId || null,
      title: title.trim(),
      description: description.trim() || null,
      assignment_type: type,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      file_url,
    };

    let error;
    if (editing) {
      ({ error } = await sb.from("assignments").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = profile.id;
      ({ error } = await sb.from("assignments").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Assignment updated" : "Assignment created");
    setOpen(false);
    load();
  };

  const performDelete = async () => {
    if (!deleteRow) return;
    const { error } = await sb.from("assignments").delete().eq("id", deleteRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assignment deleted");
    setDeleteRow(null);
    load();
  };

  if (loading) return <BookLoader label="Loading assignments…" />;

  if (isTeacher && !section) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={ClipboardList}
          title="No section assigned"
          description="You're not assigned as a class teacher. Ask your administrator to assign a section so you can create assignments."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "All assignments across the school." : section ? `${section.class_name} — ${section.name}` : ""}
          </p>
        </div>
        {isTeacher && (
          <Button onClick={openCreate} className="rounded-xl bg-gradient-brand hover:opacity-95">
            <Plus className="h-4 w-4 mr-2" /> Create assignment
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardList}
              title="No assignments yet"
              description={isTeacher ? "Create your first assignment for this section." : "No assignments have been created in this school yet."}
              actionLabel={isTeacher ? "Create assignment" : undefined}
              onAction={isTeacher ? openCreate : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due</TableHead>
                  {isAdmin && <TableHead>Section</TableHead>}
                  {isAdmin && <TableHead>Teacher</TableHead>}
                  {isTeacher && <TableHead>Marked done</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.title}
                        {r.file_url && (
                          <a href={r.file_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                            <Paperclip className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.subject_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{r.assignment_type}</Badge>
                    </TableCell>
                    <TableCell>{r.due_date ? format(new Date(r.due_date), "PP") : "—"}</TableCell>
                    {isAdmin && <TableCell>{r.class_name ? `${r.class_name} - ${r.section_name}` : (r.section_name ?? "—")}</TableCell>}
                    {isAdmin && <TableCell>{r.teacher_name ?? "—"}</TableCell>}
                    {isTeacher && (
                      <TableCell>
                        <span className="text-sm">
                          <span className="font-semibold">{r.done_count}</span>
                          <span className="text-muted-foreground"> / {r.total_count}</span>
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isTeacher && (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} aria-label="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteRow(r)}
                          aria-label="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit assignment" : "New assignment"}</DialogTitle>
            <DialogDescription>
              {section ? `${section.class_name} — ${section.name}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as AssignmentType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homework">Homework</SelectItem>
                    <SelectItem value="classwork">Classwork</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal mt-1", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Attachment (optional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1" />
              {editing?.file_url && !file && (
                <a href={editing.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                  <ExternalLink className="h-3 w-3" /> Current file
                </a>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-brand hover:opacity-95">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
        title="Delete assignment?"
        description={deleteRow ? `"${deleteRow.title}" will be permanently deleted.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={performDelete}
      />
    </div>
  );
}
