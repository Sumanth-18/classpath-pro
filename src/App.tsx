import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as HotToaster } from "react-hot-toast";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
            <Route path="/students" element={
              <ProtectedRoute allow={["school_admin", "teacher"]}>
                <AppShell><Students /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/attendance" element={<Shell><ComingSoon title="Attendance" description="Mark daily student attendance" /></Shell>} />
            <Route path="/grades" element={<Shell><ComingSoon title="Grade Book" description="Enter and manage student marks" /></Shell>} />
            <Route path="/fees" element={<Shell><ComingSoon title="Fees" description="Track collections and dues" /></Shell>} />
            <Route path="/assignments" element={<Shell><ComingSoon title="Assignments" description="Create and track assignments" /></Shell>} />
            <Route path="/timetable" element={<Shell><ComingSoon title="Timetable" description="Section-wise class schedule" /></Shell>} />
            <Route path="/staff" element={
              <ProtectedRoute allow={["school_admin"]}>
                <AppShell><ComingSoon title="Staff / HR" description="Staff directory, tasks and birthdays" /></AppShell>
              </ProtectedRoute>
            } />
            <Route path="/connect" element={<Shell><ComingSoon title="Connect" description="Announcements, SMS and school calendar" /></Shell>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
