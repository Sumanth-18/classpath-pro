import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { SchoolOSLogo } from "@/components/SchoolOSLogo";
import { Button } from "@/components/ui/button";
import { ChildSelector } from "@/components/ChildSelector";
import { useChild } from "@/contexts/ChildContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Users, CalendarCheck, BookOpen, Wallet, ClipboardList, Clock,
  UserCog, Megaphone, LogOut, Menu, X, Bell, ChevronRight, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
  badgeKey?: "messages";
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["school_admin", "teacher", "parent"] },
  { to: "/students", label: "Students", icon: Users, roles: ["school_admin", "teacher"] },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["school_admin", "teacher", "parent"] },
  { to: "/grades", label: "Grade Book", icon: BookOpen, roles: ["school_admin", "teacher"] },
  { to: "/marks", label: "Marks", icon: BookOpen, roles: ["parent"] },
  { to: "/fees", label: "Fees", icon: Wallet, roles: ["school_admin", "parent"] },
  { to: "/messages", label: "Messages", icon: MessageSquare, roles: ["parent", "teacher"], badgeKey: "messages" },
  { to: "/homework", label: "Homework", icon: ClipboardList, roles: ["parent"] },
  { to: "/announcements", label: "Announcements", icon: Megaphone, roles: ["parent"] },
  { to: "/assignments", label: "Assignments", icon: ClipboardList, roles: ["school_admin", "teacher"] },
  { to: "/timetable", label: "Timetable", icon: Clock, roles: ["school_admin", "teacher"] },
  { to: "/staff", label: "Staff / HR", icon: UserCog, roles: ["school_admin"] },
  { to: "/connect", label: "Connect", icon: Megaphone, roles: ["school_admin", "teacher"] },
];

const ROLE_LABEL: Record<AppRole, string> = {
  school_admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const { profile, school, role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Try to access ChildContext (parent only) but stay safe if not mounted
  let childCtx: ReturnType<typeof useChild> | null = null;
  try { childCtx = useChild(); } catch { /* not in provider */ }

  const items = NAV.filter((n) => !role || n.roles.includes(role));

  useEffect(() => {
    if (!user?.id) { setUnread(0); return; }
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);
      if (active) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <SchoolOSLogo size="sm" />
        {school && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-sidebar-foreground line-clamp-1">{school.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              AY {school.academic_year} {school.city ? `· ${school.city}` : ""}
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const showBadge = item.badgeKey === "messages" && unread > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3">
                    <span className="relative">
                      <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-muted-foreground")} />
                      {showBadge && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-sidebar-accent/40 transition">
          <div className="h-9 w-9 rounded-full bg-gradient-brand flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
            {profile ? getInitials(profile.name) : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-sidebar-foreground truncate">{profile?.name ?? "User"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{role ? ROLE_LABEL[role] : ""}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={handleSignOut} aria-label="Sign out" className="rounded-lg h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        {SidebarBody}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border animate-fade-in">
            <button
              className="absolute top-3 right-3 h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
          <div className="h-full px-4 lg:px-8 flex items-center justify-between gap-4">
            <button
              className="lg:hidden h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="lg:hidden">
              <SchoolOSLogo size="sm" withWordmark={false} />
            </div>

            <div className="flex-1 flex items-center gap-3">
              {role === "parent" && childCtx && childCtx.children.length > 1 && (
                <ChildSelector />
              )}
            </div>

            <button className="relative h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted" aria-label="Notifications">
              <Bell className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand-600" />
            </button>

            <div className="hidden sm:flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-brand flex items-center justify-center text-primary-foreground text-[11px] font-semibold">
                {profile ? getInitials(profile.name) : "?"}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold">{profile?.name}</div>
                <div className="text-[10px] text-muted-foreground">{role ? ROLE_LABEL[role] : ""}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
