import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import CustomerDetail from "./pages/CustomerDetail";
import RevenueProcesses from "./pages/RevenueProcesses";
import LiveMonitor from "./pages/LiveMonitor";
import RecoveryCenter from "./pages/RecoveryCenter";
import Reports from "./pages/Reports";
import Chat from "./pages/Chat";
import Audit from "./pages/Audit";
import DataIngestion from "./pages/DataIngestion";
import type { AuditLogEntry } from "./types/interfaces";
import { getPageVariants } from "./lib/motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { supabase } from "./lib/supabaseClient";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

// Handles Supabase OAuth callback — Supabase SDK picks up token from URL automatically
function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/auth/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const profile = await res.json();
            if (profile.has_data) {
              navigate("/app", { replace: true });
              return;
            }
          }
        }
      } catch (err) { }
      navigate("/onboarding", { replace: true });
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
      <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const pageVariants = getPageVariants();

  function handleAuditAppend(entry: AuditLogEntry) {
    setAuditEntries((prev) => [entry, ...prev]);
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Routes location={location}>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Onboarding — accessible after signup but before main app */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Protected workspace routes */}
          <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route
            path="/customer/:id"
            element={
              <ProtectedRoute>
                <CustomerDetail onAuditAppend={handleAuditAppend} />
              </ProtectedRoute>
            }
          />
          <Route path="/data" element={<ProtectedRoute><DataIngestion /></ProtectedRoute>} />
          <Route path="/processes" element={<ProtectedRoute><RevenueProcesses /></ProtectedRoute>} />
          <Route path="/live" element={<ProtectedRoute><LiveMonitor /></ProtectedRoute>} />
          <Route path="/recovery" element={<ProtectedRoute><RecoveryCenter /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route
            path="/audit"
            element={
              <ProtectedRoute>
                <Audit extraEntries={auditEntries} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AnimatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

