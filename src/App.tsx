import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/contexts/AuthContext";
import { ChildProvider } from "@/contexts/ChildContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  <ProtectedRoute>
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/*
        Standardized toasts (sonner): bottom-right, 3s auto-dismiss, themed.
        Success rendered green, error rendered red via classNames below.
      */}
      <Sonner
        position="bottom-right"
        duration={3000}
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-xl border shadow-elevated",
            success: "!bg-success !text-success-foreground !border-success",
            error: "!bg-destructive !text-destructive-foreground !border-destructive",
          },
        }}
      />
      <AuthProvider>
        <ChildProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route path="/dashboard" element={<Shell><DashboardRouter /></Shell>} />
                <Route path="/students" element={
                  <ProtectedRoute allow={["school_admin", "teacher"]}>
                    <AppShell><ErrorBoundary><Students /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/attendance" element={
                  <ProtectedRoute allow={["school_admin", "teacher", "parent"]}>
                    <AppShell><ErrorBoundary><ParentOrStaffAttendance /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/grades" element={<Shell><ComingSoon title="Grade Book" description="Enter and manage student marks" /></Shell>} />
                <Route path="/marks" element={
                  <ProtectedRoute allow={["parent"]}>
                    <AppShell><ErrorBoundary><ParentMarks /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/fees" element={
                  <ProtectedRoute allow={["school_admin", "teacher", "parent"]}>
                    <AppShell><ErrorBoundary><Fees /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/messages" element={
                  <ProtectedRoute allow={["parent", "teacher"]}>
                    <AppShell><ErrorBoundary><Messages /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/homework" element={
                  <ProtectedRoute allow={["parent"]}>
                    <AppShell><ErrorBoundary><ParentHomework /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/announcements" element={
                  <ProtectedRoute allow={["parent"]}>
                    <AppShell><ErrorBoundary><ParentAnnouncements /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/assignments" element={<Shell><ComingSoon title="Assignments" description="Create and track assignments" /></Shell>} />
                <Route path="/timetable" element={<Shell><ComingSoon title="Timetable" description="Section-wise class schedule" /></Shell>} />
                <Route path="/staff" element={
                  <ProtectedRoute allow={["school_admin"]}>
                    <AppShell><ErrorBoundary><Staff /></ErrorBoundary></AppShell>
                  </ProtectedRoute>
                } />
                <Route path="/connect" element={<Shell><ComingSoon title="Connect" description="Announcements, SMS and school calendar" /></Shell>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
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
