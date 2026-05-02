import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional fallback element. If omitted, renders the default error card. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console; production teams can swap in a real reporter here.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card shadow-elevated p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This page hit an unexpected error. You can retry, or head back to the dashboard.
            </p>
            <pre className="text-[11px] text-left text-muted-foreground bg-muted/50 rounded-lg p-2 mt-3 overflow-x-auto max-h-32">
              {this.state.error.message}
            </pre>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button onClick={this.reset} className="rounded-lg bg-gradient-brand hover:opacity-95">
                <RotateCcw className="h-4 w-4 mr-1.5" /> Retry
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard")} className="rounded-lg">
                Go to dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
