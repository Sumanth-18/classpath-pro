import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, ChevronRight, Loader2, Upload, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { ImportStudentsDialog } from "@/components/ImportStudentsDialog";
import { StudentDetailDialog } from "@/components/StudentDetailDialog";
import { EditStudentDialog } from "@/components/EditStudentDialog";

type Gender = "male" | "female" | "other";

interface Section {
  id: string;
  name: string;
  classes: { id: string; name: string } | null;
}

interface Student {
  id: string;
  name: string;
  admission_number: string;
  gender: Gender | null;
  date_of_birth: string | null;
  section_id: string | null;
  sections: { id: string; name: string; classes: { name: string } | null } | null;
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function formatDob(dob: string | null) {
  if (!dob) return "—";
  return new Date(dob).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function genderBadge(g: Gender | null) {
  if (g === "male") return "bg-info-soft text-info";
  if (g === "female") return "bg-brand-50 text-brand-600";
  return "bg-muted text-muted-foreground";
}

export default function Students() {
  const { school, role } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewStudentId, setViewStudentId] = useState<string | null>(null);

  const canAdd = role === "school_admin";

  const load = async () => {
    if (!school?.id) return;
    setLoading(true);
    const [{ data: studentsData }, { data: sectionsData }] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, admission_number, gender, date_of_birth, section_id, sections (id, name, classes (name))")
        .eq("school_id", school.id)
        .eq("is_active", true)
        .order("admission_number"),
      supabase
        .from("sections")
        .select("id, name, classes (id, name)")
        .eq("school_id", school.id)
        .order("name"),
    ]);
    setStudents((studentsData as any) ?? []);
    setSections((sectionsData as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.admission_number.toLowerCase().includes(search.toLowerCase());
      const matchSection = filterSection === "all" || s.section_id === filterSection;
      return matchSearch && matchSection;
    });
  }, [students, search, filterSection]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">{students.length} active student{students.length === 1 ? "" : "s"} enrolled</p>
        </div>
        {canAdd && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="h-4 w-4 mr-1.5" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-gradient-brand hover:opacity-95 shadow-brand h-10">
                  <Plus className="h-4 w-4 mr-1.5" /> Add Student
                </Button>
              </DialogTrigger>
              <AddStudentDialog
                sections={sections}
                schoolId={school!.id}
                onAdded={() => { setOpen(false); load(); }}
              />
            </Dialog>
          </div>
        )}
      </div>

      {canAdd && school?.id && (
        <ImportStudentsDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          schoolId={school.id}
          sections={sections as any}
          onImported={load}
        />
      )}

      {/* Filters */}
      <div className="card-soft p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or admission number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-11"
          />
        </div>
        <Select value={filterSection} onValueChange={setFilterSection}>
          <SelectTrigger className="rounded-xl h-11 sm:w-64">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.classes?.name}-{s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="card-soft overflow-hidden">
        {loading ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm text-muted-foreground">No students found.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Student</th>
                  <th className="px-5 py-3 font-semibold">Adm. No.</th>
                  <th className="px-5 py-3 font-semibold">Class</th>
                  <th className="px-5 py-3 font-semibold">Gender</th>
                  <th className="px-5 py-3 font-semibold">DOB</th>
                  <th className="px-5 py-3 font-semibold text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-brand text-primary-foreground flex items-center justify-center text-xs font-semibold">
                          {getInitials(s.name)}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{s.admission_number}</td>
                    <td className="px-5 py-3">
                      {s.sections ? (
                        <span className="text-foreground">
                          {s.sections.classes?.name}-{s.sections.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {s.gender && (
                        <span className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${genderBadge(s.gender)}`}>
                          {s.gender}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDob(s.date_of_birth)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setViewStudentId(s.id)}
                        className="text-primary text-xs font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        View <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentDetailDialog
        open={viewStudentId !== null}
        onOpenChange={(v) => { if (!v) setViewStudentId(null); }}
        studentId={viewStudentId}
      />
    </div>
  );
}

function AddStudentDialog({
  sections, schoolId, onAdded,
}: { sections: Section[]; schoolId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [section, setSection] = useState<string>("");
  const [gender, setGender] = useState<Gender>("male");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !adm || !section) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    const normalizedAdm = adm.trim().toUpperCase();
    const { error } = await supabase.from("students").insert({
      school_id: schoolId, section_id: section, name, admission_number: normalizedAdm, gender,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        toast.error(`Admission number "${normalizedAdm}" is already used in this school`);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(`${name} added!`);
      setName(""); setAdm(""); setSection(""); setGender("male");
      onAdded();
    }
  };

  return (
    <DialogContent className="rounded-2xl">
      <DialogHeader>
        <DialogTitle className="font-display">Add a new student</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sname">Full Name</Label>
          <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" placeholder="Aarav Kumar" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sadm">Admission Number</Label>
          <Input id="sadm" value={adm} onChange={(e) => setAdm(e.target.value)} className="rounded-xl h-11" placeholder="SS123" />
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
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={onAdded}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-xl bg-gradient-brand">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Student"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
