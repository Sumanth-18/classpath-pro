import { useNavigate } from "react-router-dom";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ComingSoon({ title, description }: { title: string; description?: string }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="card-soft p-12 lg:p-16 text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
          <Construction className="h-7 w-7 text-brand-600" />
        </div>
        <h2 className="font-display font-semibold text-lg">Coming up next</h2>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
          This page is part of SchoolOS and will be built in the next iteration. Auth, multi-tenancy and the data model are already in place.
        </p>
        <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl bg-gradient-brand">
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
