import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Receipt } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  student: {
    student_id: string;
    student_name: string;
    pending: number;
  };
  onSaved: () => void;
}

export function RecordPaymentDialog({ open, onOpenChange, schoolId, student, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "cheque" | "card" | "online">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(student.pending > 0 ? String(student.pending) : "");
      setMode("cash"); setNote("");
    }
  }, [open, student]);

  const save = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > student.pending + 0.01) {
      if (!confirm("Amount exceeds pending balance. Continue?")) return;
    }
    setSaving(true);
    try {
      const receiptNumber = `RCT-${Date.now().toString(36).toUpperCase()}`;
      const { data: pay, error } = await supabase
        .from("fee_payments")
        .insert({
          school_id: schoolId,
          student_id: student.student_id,
          amount_paid: amt,
          payment_mode: mode,
          payment_date: new Date().toISOString().slice(0, 10),
          receipt_number: receiptNumber,
          note: note.trim() || null,
          status: "paid",
        } as any)
        .select("id").single();
      if (error) throw error;

      // Generate receipt (don't block UX too long; surface failure as warning)
      const { error: fnErr } = await supabase.functions.invoke("generate-fee-receipt", { body: { payment_id: pay.id } });
      if (fnErr) {
        toast.success("Payment recorded — receipt PDF will be generated later");
      } else {
        toast.success("Payment recorded with receipt");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Record payment</DialogTitle>
          <DialogDescription>For {student.student_name} · pending ₹{student.pending.toLocaleString("en-IN")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Payment method</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="online">Online / Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Cheque #, transaction ref, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save & generate receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
