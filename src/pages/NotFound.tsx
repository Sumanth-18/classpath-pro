import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SchoolOSLogo } from "@/components/SchoolOSLogo";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-6"><SchoolOSLogo size="md" /></div>
        <div className="text-7xl font-display font-bold text-brand-600">404</div>
        <h1 className="font-display text-xl font-semibold mt-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          We couldn't find <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code>
        </p>
        <Button onClick={() => navigate("/dashboard")} className="rounded-xl bg-gradient-brand">Back to Dashboard</Button>
      </div>
    </div>
  );
};

export default NotFound;
