import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import ScrollToTop from "./components/layout/ScrollToTop";
import AdminLayout from "./components/layout/AdminLayout";
import { LayoutProvider } from "./contexts/LayoutContext";
import { Loader2 } from "lucide-react";

const Home = lazy(() => import("./pages/public/Home"));
const Login = lazy(() => import("./pages/public/Login"));
const Register = lazy(() => import("./pages/public/Register"));
const InviteRegister = lazy(() => import("./pages/public/InviteRegister"));
const VerifyAccreditation = lazy(() => import("./pages/public/VerifyAccreditation"));
const ScannerPage = lazy(() => import("./pages/public/Scanner"));
const SpectatorPortal = lazy(() => import("./pages/public/SpectatorPortal"));
const SpectatorTicket = lazy(() => import("./pages/public/SpectatorTicket"));

const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Events = lazy(() => import("./pages/admin/Events"));
const Accreditations = lazy(() => import("./pages/admin/Accreditations"));
const Zones = lazy(() => import("./pages/admin/Zones"));
const Users = lazy(() => import("./pages/admin/Users"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const QRSystem = lazy(() => import("./pages/admin/QRSystem"));
const BroadcastHistory = lazy(() => import("./pages/admin/BroadcastHistory"));
const Ticketing = lazy(() => import("./pages/admin/Ticketing"));

const PageLoader = () => (
  <div id="app_pageloader" className="flex items-center justify-center min-h-screen bg-swim-deep">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
      <p className="text-lg text-slate-400 font-extralight">Loading...</p>
    </div>
  </div>
);

import GlobalNetworkBanner from "./components/ui/GlobalNetworkBanner";

export default function App() {
  return (
    <Router>
      <GlobalNetworkBanner />
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <LayoutProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register/:slug" element={<Register />} />
              <Route path="/register/:eventSlug/invite/:token" element={<InviteRegister />} />
              <Route path="/verify/:id" element={<VerifyAccreditation />} />
              <Route path="/accreditation/:id" element={<VerifyAccreditation />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/tickets/:slug" element={<SpectatorPortal />} />
              <Route path="/view-ticket/:id" element={<SpectatorTicket />} />

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="events/:id?/:subpage?" element={<Events />} />
                <Route path="ticketing" element={<Ticketing />} />
                <Route path="accreditations" element={<Accreditations />} />
                <Route path="zones" element={<Zones />} />
                <Route path="qr-system" element={<QRSystem />} />
                <Route path="broadcasts" element={<BroadcastHistory />} />
                <Route path="users" element={<Users />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<AuditLog />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </LayoutProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
