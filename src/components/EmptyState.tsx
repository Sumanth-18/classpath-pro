import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary slot for custom action element (e.g. a Link button). */
  action?: ReactNode;
  className?: string;
}

/**
 * EmptyState — friendly placeholder for empty lists/tables/cards.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4 py-10 rounded-xl border border-dashed border-border bg-muted/20",
        className,
      )}
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action ?? (
        actionLabel && onAction && (
          <Button
            size="sm"
            onClick={onAction}
            className="mt-4 rounded-lg bg-gradient-brand hover:opacity-95"
          >
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
