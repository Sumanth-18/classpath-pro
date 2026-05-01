import { useChild } from "@/contexts/ChildContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap } from "lucide-react";

export function ChildSelector() {
  const { children, activeChild, setActiveChildId, loading } = useChild();
  if (loading || children.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
      <GraduationCap className="h-4 w-4 text-primary" />
      <Select value={activeChild?.id ?? ""} onValueChange={setActiveChildId}>
        <SelectTrigger className="h-8 border-0 bg-transparent text-sm font-semibold focus:ring-0 focus:ring-offset-0 w-auto min-w-[140px]">
          <SelectValue placeholder="Select child" />
        </SelectTrigger>
        <SelectContent>
          {children.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} <span className="text-muted-foreground">· {c.classLabel}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
