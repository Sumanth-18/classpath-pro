import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SchoolOSLogo } from "@/components/SchoolOSLogo";
import { InstallBanner } from "@/components/InstallBanner";
import { Loader2, Shield, GraduationCap, Heart } from "lucide-react";
import toast from "react-hot-toast";

const DEMO_PASSWORD = "demo1234";
const DEMO_ACCOUNTS = {
  admin: { email: "admin@demo.schoolos.app", label: "Admin Demo", icon: Shield, color: "from-brand-500 to-brand-700" },
  teacher: { email: "teacher@demo.schoolos.app", label: "Teacher Demo", icon: GraduationCap, color: "from-info to-info" },
  parent: { email: "parent@demo.schoolos.app", label: "Parent Demo", icon: Heart, color: "from-violet to-violet" },
} as const;

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    }
  };

  const handleDemo = async (key: keyof typeof DEMO_ACCOUNTS) => {
    setDemoLoading(key);
    const { error } = await signIn(DEMO_ACCOUNTS[key].email, DEMO_PASSWORD);
    setDemoLoading(null);
    if (error) {
      toast.error(error);
    } else {
      toast.success(`Logged in as ${DEMO_ACCOUNTS[key].label}`);
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex justify-center mb-6">
          <SchoolOSLogo size="lg" />
        </div>

        <div className="card-elevated p-7 shadow-elevated">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-display font-bold">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your school</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl bg-gradient-brand hover:opacity-95 shadow-brand">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Try a demo</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DEMO_ACCOUNTS) as Array<keyof typeof DEMO_ACCOUNTS>).map((key) => {
              const acc = DEMO_ACCOUNTS[key];
              const Icon = acc.icon;
              const isLoading = demoLoading === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDemo(key)}
                  disabled={!!demoLoading}
                  className="group flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 hover:border-brand-300 hover:bg-brand-50 transition disabled:opacity-50"
                >
                  <div className={`h-9 w-9 rounded-xl bg-gradient-brand flex items-center justify-center text-primary-foreground`}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{acc.label.replace(" Demo", "")}</span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New school?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Register your school
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Trusted by schools across India · 🇮🇳
        </p>
      </div>
      <InstallBanner />
    </div>
  );
}
