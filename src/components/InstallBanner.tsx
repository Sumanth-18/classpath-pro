import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "schoolos.installBannerDismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Already installed (running standalone) — nothing to do
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      localStorage.setItem(DISMISS_KEY, "1");
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] animate-fade-in">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-elevated p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-brand flex items-center justify-center text-primary-foreground shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install SchoolOS</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Install SchoolOS on your home screen for quick access
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button size="sm" onClick={handleInstall} className="rounded-lg bg-gradient-brand hover:opacity-95">
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="rounded-lg">
              Dismiss
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
