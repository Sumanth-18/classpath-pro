import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Loader2, Pencil, Trash2, BookOpen, Upload, Mail, Phone, Send } from "lucide-react";
import toast from "react-hot-toast";
import { StaffFormDialog } from "@/components/StaffFormDialog";
import { TeacherAssignmentsDialog } from "@/components/TeacherAssignmentsDialog";
import { ImportStaffDialog } from "@/components/ImportStaffDialog";

export type StaffRole = "teacher" | "school_admin";

export interface StaffRow {
  profile_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  role: StaffRole;
  invite_status: "invited" | "active" | "expired";
  invited_at: string | null;
  staff: {
    id: string;
    employee_id: string | null;
    designation: string | null;
    department: string | null;
    date_of_joining: string | null;
    salary: number | null;
  } | null;
}

type InviteBadge = "active" | "invited" | "expired";

function inviteState(r: StaffRow): InviteBadge {
  if (r.invite_status === "active") return "active";
  if (r.invited_at) {
    const days = (Date.now() - new Date(r.invited_at).getTime()) / 86_400_000;
    if (days > 7) return "expired";
  }
  return "invited";
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

function roleBadge(role: StaffRole) {
  if (role === "school_admin") return "bg-brand-50 text-brand-600";
  return "bg-info-soft text-info";
}

function deptCategory(dept: string | null): "teaching" | "non_teaching" {
  const d = (dept ?? "").toLowerCase();
  if (!d) return "teaching";
  if (["admin", "administration", "accounts", "finance", "hr", "support", "transport", "library", "maintenance", "security", "reception"].some((k) => d.includes(k))) {
    return "non_teaching";
  }
  return "teaching";
}

export default function Staff() {
  const { school, role } = useAuth();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "teaching" | "non_teaching">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffRow | null>(null);
  const [assignFor, setAssignFor] = useState<StaffRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const canManage = role === "school_admin";

  const load = async () => {
    if (!school?.id) return;
    setLoading(true);
    const [{ data: profiles }, { data: staff }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, name, email, phone, is_active, invite_status, invited_at")
        .eq("school_id", school.id)
        .order("name"),
      supabase
        .from("staff_profiles")
        .select("id, user_id, employee_id, designation, department, date_of_joining, salary")
        .eq("school_id", school.id),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("school_id", school.id),
    ]);

    const staffMap = new Map<string, NonNullable<StaffRow["staff"]>>();
    (staff ?? []).forEach((s) => staffMap.set(s.user_id, s as any));
    const roleMap = new Map<string, StaffRole>();
    (roles ?? []).forEach((r: any) => {
      if (r.role === "teacher" || r.role === "school_admin") {
        // school_admin wins over teacher
        if (roleMap.get(r.user_id) === "school_admin") return;
        roleMap.set(r.user_id, r.role);
      }
    });

    const merged: StaffRow[] = (profiles ?? [])
      .map((p: any) => {
        const userRole = roleMap.get(p.user_id);
        if (!userRole) return null; // skip parents/students
        return {
          profile_id: p.id,
          user_id: p.user_id,
          name: p.name,
          email: p.email,
          phone: p.phone,
          is_active: p.is_active ?? true,
          role: userRole,
          invite_status: (p.invite_status ?? "active") as StaffRow["invite_status"],
          invited_at: p.invited_at ?? null,
          staff: staffMap.get(p.user_id) ?? null,
        } as StaffRow;
      })
      .filter((x): x is StaffRow => x !== null);

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch = !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.staff?.employee_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.staff?.designation ?? "").toLowerCase().includes(search.toLowerCase());
      const cat = deptCategory(r.staff?.department ?? null);
      const matchRole = filterRole === "all" || cat === filterRole;
      return matchSearch && matchRole;
    });
  }, [rows, search, filterRole]);

  const teachingCount = rows.filter((r) => deptCategory(r.staff?.department ?? null) === "teaching").length;
  const nonTeachingCount = rows.length - teachingCount;
  const pendingRows = rows.filter((r) => inviteState(r) !== "active");

  const resendInvite = async (r: StaffRow) => {
    if (!school?.id) return;
    const { data, error } = await supabase.functions.invoke("invite-staff", {
      body: {
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        school_id: school.id,
        designation: r.staff?.designation ?? null,
        department: r.staff?.department ?? null,
        employee_id: r.staff?.employee_id ?? null,
        date_of_joining: r.staff?.date_of_joining ?? null,
        salary: r.staff?.salary ?? null,
        resend: true,
      },
    });
    const err = (data as any)?.error ?? error?.message;
    if (err) toast.error(err);
    else { toast.success(`Invite resent to ${r.email}`); load(); }
  };

  const inviteAllPending = async () => {
    if (pendingRows.length === 0) { toast("No pending invites"); return; }
    if (!confirm(`Resend invite to ${pendingRows.length} pending staff?`)) return;
    let ok = 0, fail = 0;
    for (const r of pendingRows) {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          name: r.name, email: r.email, phone: r.phone, role: r.role,
          school_id: school!.id,
          designation: r.staff?.designation ?? null,
          department: r.staff?.department ?? null,
          employee_id: r.staff?.employee_id ?? null,
          date_of_joining: r.staff?.date_of_joining ?? null,
          salary: r.staff?.salary ?? null,
          resend: true,
        },
      });
      if ((data as any)?.error || error) fail++; else ok++;
    }
    if (fail === 0) toast.success(`Resent ${ok} invites`);
    else toast.error(`${ok} sent · ${fail} failed`);
    load();
  };

  const handleDelete = async (r: StaffRow) => {
    if (!confirm(`Deactivate ${r.name}? They will no longer appear in the active staff list.`)) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", r.profile_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${r.name} removed from active staff`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">Staff & HR</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {teachingCount} teaching · {nonTeachingCount} non-teaching · {rows.length} total
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {pendingRows.length > 0 && (
              <Button
                variant="outline"
                className="rounded-xl h-10 border-warning/40 text-warning hover:bg-warning/10"
                onClick={inviteAllPending}
              >
                <Send className="h-4 w-4 mr-1.5" /> Invite all pending ({pendingRows.length})
              </Button>
            )}
            <Button variant="outline" className="rounded-xl h-10" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" /> Import CSV
            </Button>
            <Button
              className="rounded-xl bg-gradient-brand hover:opacity-95 shadow-brand h-10"
              onClick={() => { setEditStaff(null); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Staff
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card-soft p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, employee ID or designation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-11"
          />
        </div>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as any)}>
          <SelectTrigger className="rounded-xl h-11 sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            <SelectItem value="teaching">Teaching only</SelectItem>
            <SelectItem value="non_teaching">Non-teaching / HR</SelectItem>
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
            <div className="text-sm text-muted-foreground">No staff found.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Designation</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Emp. ID</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.profile_id} className="border-t border-border hover:bg-muted/30 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-brand text-primary-foreground flex items-center justify-center text-xs font-semibold">
                          {getInitials(r.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadge(r.role)}`}>
                            {r.role === "school_admin" ? "Admin" : "Teacher"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground">{r.staff?.designation ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.staff?.department ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.staff?.employee_id ?? "—"}</td>
                    <td className="px-5 py-3 text-xs">
                      <div className="space-y-0.5">
                        {r.email && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" /> <span className="truncate max-w-[180px]">{r.email}</span>
                          </div>
                        )}
                        {r.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {r.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canManage && r.role === "teacher" && (
                          <button
                            onClick={() => setAssignFor(r)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                            title="Assign subjects & sections"
                            aria-label={`Assign ${r.name}`}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              onClick={() => { setEditStaff(r); setFormOpen(true); }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                              title="Edit"
                              aria-label={`Edit ${r.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                              title="Remove"
                              aria-label={`Remove ${r.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {school?.id && (
        <>
          <StaffFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            schoolId={school.id}
            existing={editStaff}
            onSaved={() => { setFormOpen(false); setEditStaff(null); load(); }}
          />
          <TeacherAssignmentsDialog
            open={assignFor !== null}
            onOpenChange={(v) => { if (!v) setAssignFor(null); }}
            schoolId={school.id}
            teacher={assignFor}
          />
          <ImportStaffDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            schoolId={school.id}
            onImported={load}
          />
        </>
      )}
    </div>
  );
}
