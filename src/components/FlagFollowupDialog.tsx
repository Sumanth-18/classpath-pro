import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Flag } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  studentId: string;
  studentName: string;
  raisedBy: string;
  onSaved: () => void;
}

export function FlagFollowupDialog({ open, onOpenChange, schoolId, studentId, studentName, raisedBy, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (note.trim().length < 3) { toast.error("Add a short note"); return; }
    setSaving(true);
    const { error } = await supabase.from("fee_flags").insert({
      school_id: schoolId,
      student_id: studentId,
      raised_by: raisedBy,
      note: note.trim(),
      status: "open",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Flagged for admin follow-up");
    setNote("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> Flag for admin follow-up</DialogTitle>
          <DialogDescription>Send a note about {studentName} to the school admin.</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Note</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Reason for flagging…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send flag
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
