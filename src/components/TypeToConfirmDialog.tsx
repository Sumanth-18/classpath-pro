import { ReactNode, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The exact text the user must type to enable the destructive action. */
  confirmText: string;
  /** Optional override for the prompt label. */
  promptLabel?: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

/**
 * Type-to-confirm dialog — for high-risk destructive actions like deleting a
 * student or fee structure. Confirm button stays disabled until the user types
 * the exact `confirmText` (case-sensitive).
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  promptLabel,
  confirmLabel = "Delete",
  onConfirm,
}: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue("");
      setBusy(false);
    }
  }, [open]);

  const matches = value === confirmText;

  const handleConfirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-input" className="text-xs">
            {promptLabel ?? (
              <>
                Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm
              </>
            )}
          </Label>
          <Input
            id="confirm-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={confirmText}
            className="rounded-lg"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg" disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!matches || busy}
            className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
