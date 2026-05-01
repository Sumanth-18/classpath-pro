import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as HotToaster } from "react-hot-toast";

import { AuthProvider } from "@/contexts/AuthContext";
import { ChildProvider } from "@/contexts/ChildContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardRouter from "./pages/DashboardRouter";
import Students from "./pages/Students";
import Staff from "./pages/Staff";
import Attendance from "./pages/Attendance";
import ParentAttendance from "./pages/ParentAttendance";
import Fees from "./pages/Fees";
import Messages from "./pages/Messages";
import ParentMarks from "./pages/ParentMarks";
import ParentHomework from "./pages/ParentHomework";
import ParentAnnouncements from "./pages/ParentAnnouncements";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HotToaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "12px",
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
          },
        }}
      />
      <AuthProvider>
        <ChildProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/dashboard" element={<Shell><DashboardRouter /></Shell>} />
              <Route path="/students" element={
                <ProtectedRoute allow={["school_admin", "teacher"]}>
                  <AppShell><Students /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/attendance" element={
                <ProtectedRoute allow={["school_admin", "teacher", "parent"]}>
                  <AppShell>{/* parent gets calendar view */}
                    <ParentOrStaffAttendance />
                  </AppShell>
                </ProtectedRoute>
              } />
              <Route path="/grades" element={<Shell><ComingSoon title="Grade Book" description="Enter and manage student marks" /></Shell>} />
              <Route path="/marks" element={
                <ProtectedRoute allow={["parent"]}>
                  <AppShell><ParentMarks /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/fees" element={
                <ProtectedRoute allow={["school_admin", "teacher", "parent"]}>
                  <AppShell><Fees /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/messages" element={
                <ProtectedRoute allow={["parent", "teacher"]}>
                  <AppShell><Messages /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/homework" element={
                <ProtectedRoute allow={["parent"]}>
                  <AppShell><ParentHomework /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/announcements" element={
                <ProtectedRoute allow={["parent"]}>
                  <AppShell><ParentAnnouncements /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/assignments" element={<Shell><ComingSoon title="Assignments" description="Create and track assignments" /></Shell>} />
              <Route path="/timetable" element={<Shell><ComingSoon title="Timetable" description="Section-wise class schedule" /></Shell>} />
              <Route path="/staff" element={
                <ProtectedRoute allow={["school_admin"]}>
                  <AppShell><Staff /></AppShell>
                </ProtectedRoute>
              } />
              <Route path="/connect" element={<Shell><ComingSoon title="Connect" description="Announcements, SMS and school calendar" /></Shell>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ChildProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

// Inline dispatcher to switch between staff Attendance and parent calendar view
import { useAuth } from "@/contexts/AuthContext";
function ParentOrStaffAttendance() {
  const { role } = useAuth();
  if (role === "parent") return <ParentAttendance />;
  return <Attendance />;
}

export default App;
