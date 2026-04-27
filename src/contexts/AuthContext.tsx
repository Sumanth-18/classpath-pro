import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "school_admin" | "teacher" | "parent" | "student";

export interface SchoolProfile {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  state: string | null;
  academic_year: string | null;
  logo_url: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  school_id: string | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  school: SchoolProfile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, user_id, school_id, name, email, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    setProfile(profileData ?? null);

    if (profileData?.school_id) {
      const [{ data: schoolData }, { data: roleRows }] = await Promise.all([
        supabase.from("schools").select("id, name, email, city, state, academic_year, logo_url").eq("id", profileData.school_id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("school_id", profileData.school_id),
      ]);
      setSchool(schoolData ?? null);
      const primary = roleRows?.[0]?.role as AppRole | undefined;
      setRole(primary ?? null);
    } else {
      setSchool(null);
      setRole(null);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid blocking the auth callback
        setTimeout(() => { loadProfile(newSession.user.id); }, 0);
      } else {
        setProfile(null);
        setSchool(null);
        setRole(null);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        await loadProfile(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, school, role, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
