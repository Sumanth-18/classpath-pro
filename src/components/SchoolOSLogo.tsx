import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
}

export function SchoolOSLogo({ size = "md", withWordmark = true, className }: Props) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-12 w-12" : "h-10 w-10";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 26 : 22;
  const text = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("rounded-2xl bg-gradient-brand shadow-brand flex items-center justify-center text-primary-foreground", dims)}>
        <GraduationCap size={iconSize} strokeWidth={2.4} />
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <div className={cn("font-display font-bold tracking-tight text-foreground", text)}>SchoolOS</div>
          {size !== "sm" && <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">School ERP</div>}
        </div>
      )}
    </div>
  );
}
