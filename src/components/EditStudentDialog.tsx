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

type Gender = "male" | "female" | "other";

interface Section {
  id: string;
  name: string;
  classes: { id: string; name: string } | null;
}

interface StudentEditable {
  id: string;
  name: string;
  admission_number: string;
  gender: Gender | null;
  date_of_birth: string | null;
  section_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: StudentEditable | null;
  sections: Section[];
  onSaved: () => void;
}

export function EditStudentDialog({ open, onOpenChange, student, sections, onSaved }: Props) {
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [section, setSection] = useState<string>("");
  const [gender, setGender] = useState<Gender>("male");
  const [dob, setDob] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setAdm(student.admission_number);
      setSection(student.section_id ?? "");
      setGender((student.gender ?? "male") as Gender);
      setDob(student.date_of_birth ?? "");
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    if (!name.trim() || !adm.trim()) {
      toast.error("Name and admission number are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("students")
      .update({
        name: name.trim(),
        admission_number: adm.trim().toUpperCase(),
        section_id: section || null,
        gender,
        date_of_birth: dob || null,
      })
      .eq("id", student.id);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        toast.error(`Admission number "${adm.toUpperCase()}" is already used in this school`);
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Student updated");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Edit student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ename">Full Name</Label>
            <Input id="ename" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eadm">Admission Number</Label>
            <Input
              id="eadm"
              value={adm}
              onChange={(e) => setAdm(e.target.value)}
              className="rounded-xl h-11 uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Class / Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.classes?.name}-{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edob">Date of Birth</Label>
            <Input
              id="edob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-xl bg-gradient-brand">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
