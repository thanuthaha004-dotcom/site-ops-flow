import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Login from "./pages/Login";
import PendingApproval from "./pages/PendingApproval";
import { Loader2 } from "lucide-react";

// Code-split every non-critical route so the login screen ships a tiny bundle.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Fleet = lazy(() => import("./pages/Fleet"));
const Workforce = lazy(() => import("./pages/Workforce"));
const Attendance = lazy(() => import("./pages/Attendance"));
const TripPlanning = lazy(() => import("./pages/TripPlanning"));
const Engineers = lazy(() => import("./pages/Engineers"));
const EngineerTripSubmit = lazy(() => import("./pages/EngineerTripSubmit"));
const MyTripRequests = lazy(() => import("./pages/engineer/MyTripRequests"));
const DriverDashboard = lazy(() => import("./pages/driver/Dashboard"));
const MyTrips = lazy(() => import("./pages/driver/MyTrips"));
const TripDetail = lazy(() => import("./pages/driver/TripDetail"));
const DriverApprovals = lazy(() => import("./pages/admin/DriverApprovals"));
const ZoneManagement = lazy(() => import("./pages/admin/ZoneManagement"));

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function FullscreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoutes() {
  const { user, role, pending, loading, roleLoading } = useAuth();

  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roleLoading && !role) return <FullscreenLoader />;
  if (pending) return <PendingApproval />;

  return (
    <Suspense fallback={<FullscreenLoader />}>
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
              <Route path="/zones" element={<ZoneManagement />} />
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
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<FullscreenLoader />}>
            <Routes>
              <Route path="/login" element={<LoginGuard />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function LoginGuard() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default App;
