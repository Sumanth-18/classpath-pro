import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookLoader } from "@/components/BookLoader";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { Megaphone, MessageSquare, CalendarDays, Plus, Pencil, Trash2, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const sb: any = supabase;

type Audience = "everyone" | "parents" | "teachers" | "students";
type AnnType = "general" | "event" | "holiday" | "urgent";
type EventType = "holiday" | "event" | "exam" | "meeting";

interface Announcement {
  id: string; title: string; content: string | null; audience: Audience; type: AnnType;
  is_published: boolean; created_at: string;
}
interface WALog {
  id: string; created_at: string; to_phone: string | null; message: string | null;
  trigger_type: string | null; status: string | null; student_id: string | null;
  student_name?: string | null;
}
interface SchoolEvent {
  id: string; title: string; description: string | null; event_date: string;
  event_type: EventType;
}

export default function Connect() {
  const { school } = useAuth();
  const [tab, setTab] = useState("announcements");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect</h1>
        <p className="text-sm text-muted-foreground">Announcements, WhatsApp logs and school events.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="announcements"><Megaphone className="h-4 w-4 mr-1.5" />Announcements</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageSquare className="h-4 w-4 mr-1.5" />WhatsApp Logs</TabsTrigger>
          <TabsTrigger value="events"><CalendarDays className="h-4 w-4 mr-1.5" />School Events</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab schoolId={school?.id} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsappTab schoolId={school?.id} />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab schoolId={school?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Announcements ---------- */
function AnnouncementsTab({ schoolId }: { schoolId?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [type, setType] = useState<AnnType>("general");
  const [saving, setSaving] = useState(false);
  const [delRow, setDelRow] = useState<Announcement | null>(null);
  const { profile } = useAuth();

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, content, audience, type, is_published, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Announcement[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolId]);

  const openCreate = () => {
    setEditing(null); setTitle(""); setContent(""); setAudience("everyone"); setType("general"); setOpen(true);
  };
  const openEdit = (r: Announcement) => {
    setEditing(r); setTitle(r.title); setContent(r.content ?? ""); setAudience(r.audience); setType(r.type); setOpen(true);
  };
  const save = async () => {
    if (!schoolId) return;
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload: any = {
      school_id: schoolId, title: title.trim(),
      content: content.trim() || null, audience, type, is_published: true,
    };
    let error;
    if (editing) {
      ({ error } = await sb.from("announcements").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = profile?.user_id ?? null;
      ({ error } = await sb.from("announcements").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Posted");
    setOpen(false); load();
  };
  const remove = async () => {
    if (!delRow) return;
    const { error } = await sb.from("announcements").delete().eq("id", delRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDelRow(null); load();
  };

  if (loading) return <BookLoader label="Loading announcements…" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="rounded-xl bg-gradient-brand hover:opacity-95">
          <Plus className="h-4 w-4 mr-2" /> New announcement
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Post your first school-wide update."
            actionLabel="New announcement"
            onAction={openCreate}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{r.title}</h3>
                    <Badge variant="outline" className="capitalize">{r.type}</Badge>
                    <Badge variant="secondary" className="capitalize">{r.audience}</Badge>
                  </div>
                  {r.content && <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{r.content}</p>}
                  <p className="text-[11px] text-muted-foreground mt-2">{format(new Date(r.created_at), "PPp")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDelRow(r)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="parents">Parents</SelectItem>
                    <SelectItem value="teachers">Teachers</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as AnnType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-brand hover:opacity-95">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Save" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!delRow}
        onOpenChange={(o) => !o && setDelRow(null)}
        title="Delete announcement?"
        description={delRow ? `"${delRow.title}" will be permanently removed.` : ""}
        destructive
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}

/* ---------- WhatsApp Logs ---------- */
function WhatsappTab({ schoolId }: { schoolId?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WALog[]>([]);
  const [trigger, setTrigger] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("whatsapp_logs")
        .select("id, created_at, to_phone, message, trigger_type, status, student_id")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as WALog[];
      const studentIds = Array.from(new Set(list.map((r) => r.student_id).filter(Boolean) as string[]));
      let nameMap = new Map<string, string>();
      if (studentIds.length) {
        const { data: studs } = await supabase.from("students").select("id, name").in("id", studentIds);
        (studs ?? []).forEach((s: any) => nameMap.set(s.id, s.name));
      }
      list.forEach((r) => { r.student_name = r.student_id ? nameMap.get(r.student_id) ?? null : null; });
      setRows(list);
      setLoading(false);
    })();
  }, [schoolId]);

  const triggers = useMemo(() => Array.from(new Set(rows.map((r) => r.trigger_type).filter(Boolean) as string[])), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status).filter(Boolean) as string[])), [rows]);

  const filtered = rows.filter((r) =>
    (trigger === "all" || r.trigger_type === trigger) &&
    (status === "all" || r.status === status)
  );

  if (loading) return <BookLoader label="Loading WhatsApp logs…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Label className="text-xs">Trigger type</Label>
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {triggers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={MessageSquare} title="No WhatsApp logs" description="No messages match your filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.student_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.to_phone ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={r.message ?? ""}>{r.message ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.trigger_type ?? "—"}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                        {r.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), "PP p")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- School Events ---------- */
function EventsTab({ schoolId }: { schoolId?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SchoolEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [eventType, setEventType] = useState<EventType>("event");
  const [saving, setSaving] = useState(false);
  const [delRow, setDelRow] = useState<SchoolEvent | null>(null);

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data } = await supabase
      .from("school_events")
      .select("id, title, description, event_date, event_type")
      .eq("school_id", schoolId)
      .order("event_date", { ascending: false });
    setRows((data ?? []) as SchoolEvent[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [schoolId]);

  const openCreate = () => {
    setTitle(""); setDescription(""); setDate(new Date()); setEventType("event"); setOpen(true);
  };
  const save = async () => {
    if (!schoolId) return;
    if (!title.trim() || !date) { toast.error("Title and date are required"); return; }
    setSaving(true);
    const { error } = await sb.from("school_events").insert({
      school_id: schoolId, title: title.trim(),
      description: description.trim() || null,
      event_date: format(date, "yyyy-MM-dd"),
      event_type: eventType,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Event added");
    setOpen(false); load();
  };
  const remove = async () => {
    if (!delRow) return;
    const { error } = await sb.from("school_events").delete().eq("id", delRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDelRow(null); load();
  };

  if (loading) return <BookLoader label="Loading events…" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="rounded-xl bg-gradient-brand hover:opacity-95">
          <Plus className="h-4 w-4 mr-2" /> Add event
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={CalendarDays}
            title="No school events yet"
            description="Add holidays, exams and meetings to your school calendar."
            actionLabel="Add event"
            onAction={openCreate}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.event_type}</Badge></TableCell>
                    <TableCell>{format(new Date(r.event_date), "PP")}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{r.description ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setDelRow(r)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
            <DialogDescription>Holidays appear as gray days on the attendance calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-normal mt-1", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-brand hover:opacity-95">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!delRow}
        onOpenChange={(o) => !o && setDelRow(null)}
        title="Delete event?"
        description={delRow ? `"${delRow.title}" will be permanently removed.` : ""}
        destructive
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </div>
  );
}
