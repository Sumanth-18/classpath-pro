import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { StaffRow, StaffRole } from "@/pages/Staff";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  existing: StaffRow | null;
  onSaved: () => void;
}

const DEPARTMENTS = [
  "Teaching",
  "Administration",
  "Accounts",
  "HR",
  "Library",
  "Transport",
  "Support",
  "Reception",
  "Maintenance",
  "Security",
];

export function StaffFormDialog({ open, onOpenChange, schoolId, existing, onSaved }: Props) {
  const isEdit = existing !== null;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("teacher");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("Teaching");
  const [employeeId, setEmployeeId] = useState("");
  const [doj, setDoj] = useState("");
  const [salary, setSalary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setEmail(existing.email ?? "");
      setPhone(existing.phone ?? "");
      setRole(existing.role);
      setDesignation(existing.staff?.designation ?? "");
      setDepartment(existing.staff?.department ?? "Teaching");
      setEmployeeId(existing.staff?.employee_id ?? "");
      setDoj(existing.staff?.date_of_joining ?? "");
      setSalary(existing.staff?.salary != null ? String(existing.staff.salary) : "");
    } else {
      setName(""); setEmail(""); setPhone("");
      setRole("teacher");
      setDesignation(""); setDepartment("Teaching");
      setEmployeeId(""); setDoj(""); setSalary("");
    }
  }, [existing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!isEdit && !email.trim()) { toast.error("Email is required for new staff"); return; }

    setSubmitting(true);

    // Case-insensitive employee_id duplicate check within school
    if (employeeId.trim()) {
      const empIdLower = employeeId.trim().toLowerCase();
      const { data: dupes } = await supabase
        .from("staff_profiles")
        .select("id, employee_id")
        .eq("school_id", schoolId);
      const conflict = (dupes ?? []).find(
        (d: any) =>
          (d.employee_id ?? "").toLowerCase() === empIdLower &&
          (!isEdit || d.id !== existing?.staff?.id)
      );
      if (conflict) {
        setSubmitting(false);
        toast.error(`Employee ID "${employeeId.trim()}" already exists`);
        return;
      }
    }

    const staffPayload = {
      school_id: schoolId,
      designation: designation.trim() || null,
      department: department || null,
      employee_id: employeeId.trim() || null,
      date_of_joining: doj || null,
      salary: salary ? Number(salary) : null,
    };

    if (isEdit && existing) {
      // Update profile
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("id", existing.profile_id);
      if (pErr) { setSubmitting(false); toast.error(pErr.message); return; }

      // Upsert staff_profiles
      if (existing.staff) {
        const { error: sErr } = await supabase
          .from("staff_profiles")
          .update(staffPayload)
          .eq("id", existing.staff.id);
        if (sErr) { setSubmitting(false); toast.error(sErr.message); return; }
      } else {
        const { error: sErr } = await supabase
          .from("staff_profiles")
          .insert({ ...staffPayload, user_id: existing.user_id });
        if (sErr) { setSubmitting(false); toast.error(sErr.message); return; }
      }

      // Role change
      if (existing.role !== role) {
        await supabase.from("user_roles")
          .delete()
          .eq("user_id", existing.user_id)
          .eq("school_id", schoolId);
        const { error: rErr } = await supabase
          .from("user_roles")
          .insert({ user_id: existing.user_id, school_id: schoolId, role });
        if (rErr) { setSubmitting(false); toast.error(rErr.message); return; }
      }

      setSubmitting(false);
      toast.success("Staff updated");
      onSaved();
      return;
    }

    // CREATE: invite via secure edge function
    const { data, error } = await supabase.functions.invoke("invite-staff", {
      body: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        role,
        school_id: schoolId,
        designation: designation.trim() || null,
        department: department || null,
        employee_id: employeeId.trim() || null,
        date_of_joining: doj || null,
        salary: salary ? Number(salary) : null,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Could not invite staff");
      return;
    }
    toast.success(`Invite sent to ${email.trim()}`);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{isEdit ? "Edit staff member" : "Add a staff member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sn">Full name</Label>
              <Input id="sn" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" placeholder="e.g. Anita Verma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="se">Email</Label>
              <Input id="se" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-11" placeholder="anita@school.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp">Phone</Label>
              <Input id="sp" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl h-11" placeholder="9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="school_admin">School Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sd">Designation</Label>
              <Input id="sd" value={designation} onChange={(e) => setDesignation(e.target.value)} className="rounded-xl h-11" placeholder="e.g. Math Teacher" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seid">Employee ID</Label>
              <Input id="seid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-xl h-11" placeholder="e.g. EMP-001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sdoj">Date of joining</Label>
              <Input id="sdoj" type="date" value={doj} onChange={(e) => setDoj(e.target.value)} className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ssal">Monthly salary (₹)</Label>
              <Input id="ssal" type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} className="rounded-xl h-11" placeholder="35000" />
            </div>
          </div>

          {!isEdit && (
            <p className="text-[11px] text-muted-foreground">
              An email invite will be sent so they can set up their password and sign in.
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-gradient-brand">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEdit ? "Save changes" : "Add staff")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
