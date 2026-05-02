import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Plus, Trash2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ClassRow, FeeStructureRow } from "@/pages/Fees";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  classes: ClassRow[];
  existing: FeeStructureRow | null;
  onSaved: () => void;
}

interface InsRow { id?: string; label: string; amount: string; due_date: string }

export function FeeStructureDialog({ open, onOpenChange, schoolId, classes, existing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"one_time" | "monthly" | "quarterly" | "annually">("monthly");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [instalments, setInstalments] = useState<InsRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setAmount(String(existing.amount));
      setFrequency(((existing.frequency ?? "monthly") as any));
      setClassIds(existing.classes.map((c) => c.id));
      setInstalments(existing.instalments.map((i) => ({ id: i.id, label: i.label, amount: String(i.amount), due_date: i.due_date ?? "" })));
    } else {
      setName(""); setAmount(""); setFrequency("monthly"); setClassIds([]); setInstalments([]);
    }
  }, [open, existing]);

  const toggleClass = (id: string) => {
    setClassIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const save = async () => {
    if (name.trim().length < 2) { toast.error("Name is required"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) { toast.error("Amount must be a positive number"); return; }
    setSaving(true);
    try {
      let structureId = existing?.id ?? null;

      if (existing) {
        const { error } = await supabase
          .from("fee_structures")
          .update({ name: name.trim(), amount: amt, frequency })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("fee_structures")
          .insert({ school_id: schoolId, name: name.trim(), amount: amt, frequency })
          .select("id").single();
        if (error) throw error;
        structureId = data.id;
      }

      // reset class links
      await sb.from("fee_structure_classes").delete().eq("fee_structure_id", structureId!);
      if (classIds.length > 0) {
        await sb.from("fee_structure_classes").insert(
          classIds.map((cid) => ({ fee_structure_id: structureId, class_id: cid, school_id: schoolId })),
        );
      }

      // reset instalments
      await sb.from("fee_instalments").delete().eq("fee_structure_id", structureId!);
      const cleanIns = instalments.filter((i) => i.label.trim() && Number(i.amount) > 0);
      if (cleanIns.length > 0) {
        await sb.from("fee_instalments").insert(
          cleanIns.map((i, idx) => ({
            fee_structure_id: structureId,
            school_id: schoolId,
            label: i.label.trim(),
            amount: Number(i.amount),
            due_date: i.due_date || null,
            sort_order: idx + 1,
          })),
        );
      }

      toast.success(existing ? "Updated" : "Created");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit fee category" : "New fee category"}</DialogTitle>
          <DialogDescription>Define amount, applicable classes and (optional) instalment plan.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuition Fee" maxLength={100} />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Applicable classes</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-4">
              {classes.length === 0 && <p className="col-span-full text-xs text-muted-foreground">No classes yet.</p>}
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={classIds.includes(c.id)} onCheckedChange={() => toggleClass(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Leave empty to apply to all classes.</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Instalment plan (optional)</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setInstalments((p) => [...p, { label: `Instalment ${p.length + 1}`, amount: "", due_date: "" }])}>
                <Plus className="mr-1 h-3 w-3" /> Add instalment
              </Button>
            </div>
            {instalments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No instalments — fee is collected as a single payment.</p>
            ) : (
              <div className="space-y-2">
                {instalments.map((ins, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder="Label" value={ins.label}
                      onChange={(e) => setInstalments((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} />
                    <Input className="col-span-3" type="number" placeholder="Amount" value={ins.amount}
                      onChange={(e) => setInstalments((p) => p.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} />
                    <Input className="col-span-3" type="date" value={ins.due_date}
                      onChange={(e) => setInstalments((p) => p.map((x, i) => i === idx ? { ...x, due_date: e.target.value } : x))} />
                    <Button className="col-span-1" type="button" variant="ghost" size="icon"
                      onClick={() => setInstalments((p) => p.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
