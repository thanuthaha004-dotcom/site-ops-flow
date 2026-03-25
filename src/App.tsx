import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Schedule from "./pages/Schedule";
import Fleet from "./pages/Fleet";
import Workforce from "./pages/Workforce";
import Attendance from "./pages/Attendance";
import TripPlanning from "./pages/TripPlanning";
import Engineers from "./pages/Engineers";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/fleet" element={<Fleet />} />
            <Route path="/workforce" element={<Workforce />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/trips" element={<TripPlanning />} />
            <Route path="/engineers" element={<Engineers />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
