import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Ann {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  audience: string | null;
  type: string | null;
}

export default function ParentAnnouncements() {
  const { school } = useAuth();
  const { activeChild } = useChild();
  const [items, setItems] = useState<Ann[]>([]);

  useEffect(() => {
    if (!school?.id) return;
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, content, created_at, audience, type")
        .eq("school_id", school.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      setItems((data ?? []) as Ann[]);
    })();
  }, [school?.id]);

  if (!activeChild) return <div className="p-12 text-center text-sm text-muted-foreground">No child selected.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">School-wide and class updates</p>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">No announcements yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Megaphone className="h-5 w-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.type && <Badge variant="secondary" className="text-[10px] capitalize">{a.type}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(parseISO(a.created_at), "dd MMM yyyy · p")}
                  </div>
                  {a.content && <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{a.content}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
