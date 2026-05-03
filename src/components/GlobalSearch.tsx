import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, GraduationCap, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Result {
  type: "student" | "staff";
  id: string;
  name: string;
  meta: string;
}

/** Global search bar — admin-only. Searches students (name + admission number)
 *  and staff (name + employee ID). Click a result to open that profile. */
export function GlobalSearch() {
  const { school, role } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // debounced search
  useEffect(() => {
    if (!school?.id || role !== "school_admin") return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [{ data: studs }, { data: staffProfs }, { data: staffByEmp }] = await Promise.all([
        supabase
          .from("students")
          .select("id, name, admission_number")
          .eq("school_id", school.id)
          .or(`name.ilike.${like},admission_number.ilike.${like}`)
          .limit(8),
        supabase
          .from("profiles")
          .select("id, user_id, name, email")
          .eq("school_id", school.id)
          .ilike("name", like)
          .limit(8),
        supabase
          .from("staff_profiles")
          .select("id, user_id, employee_id")
          .eq("school_id", school.id)
          .ilike("employee_id", like)
          .limit(8),
      ]);

      const out: Result[] = [];
      (studs ?? []).forEach((s: any) =>
        out.push({ type: "student", id: s.id, name: s.name, meta: `Adm. ${s.admission_number}` }),
      );

      // Merge staff matches by user_id
      const staffMap = new Map<string, Result>();
      (staffProfs ?? []).forEach((p: any) => {
        staffMap.set(p.user_id, { type: "staff", id: p.user_id, name: p.name, meta: p.email ?? "Staff" });
      });
      if ((staffByEmp ?? []).length) {
        const userIds = (staffByEmp as any[]).map((s) => s.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name, email")
          .in("user_id", userIds);
        (profs ?? []).forEach((p: any) => {
          const emp = (staffByEmp as any[]).find((s) => s.user_id === p.user_id)?.employee_id;
          staffMap.set(p.user_id, { type: "staff", id: p.user_id, name: p.name, meta: emp ? `ID ${emp}` : (p.email ?? "Staff") });
        });
      }
      out.push(...staffMap.values());

      setResults(out.slice(0, 12));
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q, school?.id, role]);

  if (role !== "school_admin") return null;

  const handleSelect = (r: Result) => {
    setOpen(false);
    setQ("");
    if (r.type === "student") navigate(`/students?id=${r.id}`);
    else navigate(`/staff?id=${r.id}`);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search students or staff…"
          className="h-9 pl-9 rounded-xl bg-muted/40 border-transparent focus-visible:bg-background"
          aria-label="Global search"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl border bg-popover shadow-elevated z-40 overflow-hidden">
          {results.length === 0 && !loading ? (
            <div className="p-4 text-xs text-muted-foreground text-center">No matches found.</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => {
                const Icon = r.type === "student" ? GraduationCap : UserCog;
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onClick={() => handleSelect(r)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition",
                      )}
                    >
                      <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{r.name}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{r.meta}</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.type}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
