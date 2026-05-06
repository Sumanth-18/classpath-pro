import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { Loader2, KeyRound } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string | null;
  studentName?: string;
  defaultParentName?: string;
  defaultPhone?: string;
}

export function AddParentLoginDialog({ open, onOpenChange, studentId, studentName, defaultParentName, defaultPhone }: Props) {
  const [parentName, setParentName] = useState(defaultParentName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setParentName(defaultParentName ?? "");
    setPhone(defaultPhone ?? "");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !parentName.trim() || !phone.trim() || password.length < 6) {
      toast.error("Fill all fields. Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-parent-account", {
      body: { student_id: studentId, parent_name: parentName.trim(), phone: phone.trim(), password },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed to create login");
      return;
    }
    const d = data as any;
    toast.success(`Parent login ready · phone ${d.phone}`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Set up parent login
          </DialogTitle>
          <DialogDescription>
            Create a login for {studentName ?? "this student"}'s parent. They can sign in with the mobile number or the student's admission number.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Parent name</Label>
            <Input id="pname" value={parentName} onChange={(e) => setParentName(e.target.value)} required className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pphone">Mobile number</Label>
            <Input id="pphone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-xl h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ppass">Initial password</Label>
            <Input id="ppass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" className="rounded-xl h-10" />
            <p className="text-[11px] text-muted-foreground">Share this with the parent. They can change it after first login.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-gradient-brand">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create login"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
