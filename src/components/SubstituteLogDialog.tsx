import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "@/lib/toast";

const sb: any = supabase;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultSectionId?: string;
  defaultDate?: Date;
  onSaved?: () => void;
}

export function SubstituteLogDialog({ open, onOpenChange, defaultSectionId, defaultDate, onSaved }: Props) {
  const { school, user } = useAuth();
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [sectionId, setSectionId] = useState<string>(defaultSectionId ?? "");
  const [staffId, setStaffId] = useState<string>("");
  const [date, setDate] = useState<Date>(defaultDate ?? new Date());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !school?.id) return;
    setSectionId(defaultSectionId ?? "");
    setDate(defaultDate ?? new Date());
    setNote("");
    setStaffId("");
    (async () => {
      const [{ data: secs }, { data: stf }] = await Promise.all([
        supabase.from("sections").select("id, name, classes(name)").eq("school_id", school.id),
        supabase.from("staff_profiles").select("id, user_id").eq("school_id", school.id),
      ]);
      setSections((secs ?? []).map((s: any) => ({ id: s.id, label: `${s.classes?.name ?? "Class"} - ${s.name}` })));

      const userIds = (stf ?? []).map((r: any) => r.user_id).filter(Boolean);
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("id, name, user_id").in("user_id", userIds)
        : { data: [] as any[] };
      setStaff((profs ?? []).map((p: any) => ({ id: p.id, name: p.name })));
    })();
  }, [open, school?.id, defaultSectionId, defaultDate]);

  const save = async () => {
    if (!school?.id || !sectionId || !staffId) { toast.error("Select section and substitute"); return; }
    setSaving(true);
    const { error } = await sb.from("substitute_log").insert({
      school_id: school.id,
      section_id: sectionId,
      substitute_teacher_id: staffId,
      date: format(date, "yyyy-MM-dd"),
      note: note.trim() || null,
      logged_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Substitute logged");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log substitute teacher</DialogTitle>
          <DialogDescription>Records a substitute covering a section on a date.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Section</label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Substitute teacher</label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal mt-1">
                  <CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
