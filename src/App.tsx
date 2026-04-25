import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Schedule from "./pages/Schedule";
import Fleet from "./pages/Fleet";
import Workforce from "./pages/Workforce";
import Attendance from "./pages/Attendance";
import TripPlanning from "./pages/TripPlanning";
import Engineers from "./pages/Engineers";
import EngineerTripSubmit from "./pages/EngineerTripSubmit";
import MyTripRequests from "./pages/engineer/MyTripRequests";
import DriverDashboard from "./pages/driver/Dashboard";
import MyTrips from "./pages/driver/MyTrips";
import TripDetail from "./pages/driver/TripDetail";
import DriverApprovals from "./pages/admin/DriverApprovals";
import PendingApproval from "./pages/PendingApproval";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

function ProtectedRoutes() {
  const { user, role, pending, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (pending) return <PendingApproval />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        {role === 'admin' ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/workforce" element={<Workforce />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/trips" element={<TripPlanning />} />
            <Route path="/engineers" element={<Engineers />} />
            <Route path="/driver-approvals" element={<DriverApprovals />} />
          </>
        ) : role === 'driver' ? (
          <>
            <Route path="/" element={<DriverDashboard />} />
            <Route path="/my-trips" element={<MyTrips />} />
            <Route path="/trip/:id" element={<TripDetail />} />
          </>
        ) : (
          <>
            <Route path="/" element={<EngineerTripSubmit />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/submit-trips" element={<EngineerTripSubmit />} />
            <Route path="/my-requests" element={<MyTripRequests />} />
          </>
        )}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default App;
