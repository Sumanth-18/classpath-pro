import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface ChildSummary {
  id: string;
  name: string;
  section_id: string | null;
  section_name: string | null;
  class_name: string | null;
  class_id: string | null;
  parent_phone: string | null;
  date_of_birth: string | null;
  classLabel: string;
}

interface ChildContextValue {
  children: ChildSummary[];
  activeChild: ChildSummary | null;
  setActiveChildId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ChildContext = createContext<ChildContextValue | undefined>(undefined);
const LS_KEY = "schoolos.activeChildId";

export function ChildProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [list, setList] = useState<ChildSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id || role !== "parent") {
      setList([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("parent_student")
      .select(
        `student_id,
         students!inner(
           id, name, parent_phone, date_of_birth, section_id,
           sections(id, name, class_id, classes(id, name))
         )`
      )
      .eq("parent_user_id", user.id);

    const mapped: ChildSummary[] = (data ?? []).map((r: any) => {
      const s = r.students;
      const sec = s.sections;
      const cls = sec?.classes;
      const className = cls?.name ?? null;
      const sectionName = sec?.name ?? null;
      return {
        id: s.id,
        name: s.name,
        section_id: s.section_id,
        section_name: sectionName,
        class_name: className,
        class_id: sec?.class_id ?? null,
        parent_phone: s.parent_phone ?? null,
        date_of_birth: s.date_of_birth ?? null,
        classLabel: className && sectionName ? `${className} - ${sectionName}` : (className ?? "—"),
      };
    });
    setList(mapped);

    const stored = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const valid = mapped.find((c) => c.id === stored);
    setActiveId(valid?.id ?? mapped[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, role]);

  const setActiveChildId = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem(LS_KEY, id); } catch {}
  };

  const activeChild = list.find((c) => c.id === activeId) ?? null;

  return (
    <ChildContext.Provider value={{ children: list, activeChild, setActiveChildId, loading, refresh: load }}>
      {children}
    </ChildContext.Provider>
  );
}

export function useChild() {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error("useChild must be used within ChildProvider");
  return ctx;
}
