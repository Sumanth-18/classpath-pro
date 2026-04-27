import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SchoolOSLogo } from "@/components/SchoolOSLogo";
import { Check, Loader2, CalendarCheck, BookOpen, Wallet, ClipboardList, UserCog, MessageCircle, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

const FEATURES = [
  { icon: CalendarCheck, label: "Daily attendance + WhatsApp alerts" },
  { icon: BookOpen, label: "Grade book & report cards" },
  { icon: Wallet, label: "Fee management & receipts" },
  { icon: ClipboardList, label: "Assignments & online classes" },
  { icon: UserCog, label: "Staff & HR management" },
  { icon: MessageCircle, label: "Parent communication built-in" },
];

export default function Register() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    schoolName: "",
    city: "",
    state: "",
    adminName: "",
    email: "",
    password: "",
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the school first (RLS allows authenticated insert; we'll do it after signup
      //    so we know the user exists. Approach: signup, then insert school, then update profile + role).
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: form.adminName },
        },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Signup failed");

      // 2. Sign in (in case session not set)
      if (!signUpData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (signInErr) throw signInErr;
      }

      // 3. Create school
      const { data: school, error: schoolErr } = await supabase
        .from("schools")
        .insert({
          name: form.schoolName,
          city: form.city,
          state: form.state,
          email: form.email,
          academic_year: "2026-2027",
          subscription_plan: "trial",
        })
        .select()
        .single();
      if (schoolErr) throw schoolErr;

      // 4. Update profile to attach school_id
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ school_id: school.id, name: form.adminName })
        .eq("user_id", signUpData.user.id);
      if (profErr) throw profErr;

      // 5. Create admin role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: signUpData.user.id, school_id: school.id, role: "school_admin" });
      if (roleErr) throw roleErr;

      await refresh();
      toast.success(`Welcome, ${form.schoolName}! Your 30-day free trial has started.`);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not register school");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center max-w-6xl mx-auto">
          {/* LEFT */}
          <div className="space-y-7 animate-fade-in">
            <SchoolOSLogo size="md" />
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1 mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Free for 30 days · No credit card
              </div>
              <h1 className="text-3xl lg:text-4xl font-display font-bold tracking-tight leading-tight">
                Run your entire school on <span className="text-brand-600">one platform.</span>
              </h1>
              <p className="text-muted-foreground mt-3 text-base lg:text-lg max-w-md">
                Attendance, grades, fees, timetable and parent updates — all unified, beautifully simple.
              </p>
            </div>

            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-success-soft flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-success" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 pt-2 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {["bg-brand-500", "bg-info", "bg-violet", "bg-success"].map((c, i) => (
                  <div key={i} className={`h-8 w-8 rounded-full ${c} border-2 border-background`} />
                ))}
              </div>
              <span>Loved by 1,200+ schools across India</span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="card-elevated p-7 lg:p-8 shadow-elevated animate-fade-in">
            <h2 className="text-2xl font-display font-bold">Register your school</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Set up your account in under a minute.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School Name</Label>
                <Input id="schoolName" required value={form.schoolName} onChange={update("schoolName")} placeholder="Sanskriti The School" className="rounded-xl h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required value={form.city} onChange={update("city")} placeholder="Hyderabad" className="rounded-xl h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" required value={form.state} onChange={update("state")} placeholder="Telangana" className="rounded-xl h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminName">Admin Name</Label>
                <Input id="adminName" required value={form.adminName} onChange={update("adminName")} placeholder="Your full name" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" required type="email" value={form.email} onChange={update("email")} placeholder="admin@school.edu" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" required type="password" value={form.password} onChange={update("password")} placeholder="At least 8 characters" className="rounded-xl h-11" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl bg-gradient-brand hover:opacity-95 shadow-brand">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start free trial"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-5">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
