import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import ScrollToTop from "./components/layout/ScrollToTop";
const AdminLayout = lazy(() => import("./components/layout/AdminLayout"));
import { LayoutProvider } from "./contexts/LayoutContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { Loader2 } from "lucide-react";

const Home = lazy(() => import("./pages/public/Home"));
const Login = lazy(() => import("./pages/public/Login"));
const Register = lazy(() => import("./pages/public/Register"));
const TeamRegister = lazy(() => import("./pages/public/TeamRegister"));
const InviteRegister = lazy(() => import("./pages/public/InviteRegister"));
const VerifyAccreditation = lazy(() => import("./pages/public/VerifyAccreditation"));
const ScannerPage = lazy(() => import("./pages/public/Scanner"));
const SpectatorPortal = lazy(() => import("./pages/public/SpectatorPortal"));
const SpectatorTicket = lazy(() => import("./pages/public/SpectatorTicket"));
const GenericPass = lazy(() => import("./pages/public/GenericPass"));
const FeedbackForm = lazy(() => import("./pages/public/FeedbackForm"));
const CallRoomDisplay = lazy(() => import("./pages/display/CallRoomDisplay"));

const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Events = lazy(() => import("./pages/admin/Events"));
const TeamsDashboard = lazy(() => import("./pages/admin/Teams/TeamsDashboard"));
import TeamDetail from './pages/admin/Teams/TeamDetail';
const RulesManagement = lazy(() => import("./pages/admin/Rules/RulesManagement"));
import TeamPortalGateway from './pages/portal/TeamPortalGateway';
import TeamPortalDashboard from './pages/portal/TeamPortalDashboard';
const Accreditations = lazy(() => import("./pages/admin/Accreditations"));
const Zones = lazy(() => import("./pages/admin/Zones"));
const Users = lazy(() => import("./pages/admin/Users"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const QRSystem = lazy(() => import("./pages/admin/QRSystem"));
const BroadcastHistory = lazy(() => import("./pages/admin/BroadcastHistory"));
const Ticketing = lazy(() => import("./pages/admin/Ticketing"));
const MedalRankings = lazy(() => import("./pages/admin/MedalRankings"));
const Feedback = lazy(() => import("./pages/admin/Feedback"));
const Partners = lazy(() => import("./pages/admin/Partners"));
const APIDocs = lazy(() => import("./pages/admin/APIDocs"));
const Organizations = lazy(() => import("./pages/admin/Organizations"));
const CallRoomControl = lazy(() => import("./pages/admin/CallRoomControl"));
const SwimmersRanking = lazy(() => import("./pages/admin/ranking/SwimmersRanking"));

const StaffLayout = lazy(() => import("./components/layout/StaffLayout"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const StaffSearch = lazy(() => import("./pages/staff/StaffSearch"));
const StaffSettings = lazy(() => import("./pages/staff/StaffSettings"));
const ServiceCheckin = lazy(() => import("./pages/staff/ServiceCheckin"));
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
const PageLoader = () => (
  <div id="app_pageloader" className="flex items-center justify-center min-h-screen bg-base relative overflow-hidden">
    {/* Modern high-end golden ambient blur behind loader */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
    <div className="flex flex-col items-center gap-4 relative z-10">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-lg text-slate-400 font-extralight">Loading...</p>
    </div>
  </div>
);

import GlobalNetworkBanner from "./components/ui/GlobalNetworkBanner";
import { syncService } from "./lib/syncService";

export default function App() {
  useEffect(() => {
    // Start background sync service
    syncService.start();
    return () => syncService.stop();
  }, []);

  return (
    <Router>
      <GlobalNetworkBanner />
      <ScrollToTop />
      <ToastProvider>
        <BrandingProvider>
        <AuthProvider>
          <ThemeProvider>
            <LayoutProvider>
              <BackgroundProvider>
                <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register/:slug" element={<Register />} />
              <Route path="/team-register/:slug" element={<TeamRegister />} />
              <Route path="/register/:eventSlug/invite/:token" element={<InviteRegister />} />
              <Route path="/verify/:id" element={<VerifyAccreditation />} />
              <Route path="/accreditation/:id" element={<VerifyAccreditation />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/service-checkin/:eventSlug" element={<ServiceCheckin />} />
              <Route path="/tickets" element={<SpectatorPortal />} />
              <Route path="/tickets/:slug" element={<SpectatorPortal />} />
              <Route path="/view-ticket/:id" element={<SpectatorTicket />} />
              <Route path="/generic-pass" element={<GenericPass />} />
              <Route path="/feedback/:slug" element={<FeedbackForm />} />
              <Route path="/display/:eventId/:row" element={<CallRoomDisplay />} />

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="events/:id?/:subpage?" element={<Events />} />
                <Route path="teams" element={<TeamsDashboard />} />
                <Route path="teams/:teamId" element={<TeamDetail />} />
                <Route path="rules" element={<RulesManagement />} />
                <Route path="ticketing" element={<Ticketing />} />
                <Route path="accreditations" element={<Accreditations />} />
                <Route path="zones" element={<Zones />} />
                <Route path="qr-system" element={<QRSystem />} />
                <Route path="broadcasts" element={<BroadcastHistory />} />
                <Route path="users" element={<Users />} />
                <Route path="medals" element={<MedalRankings />} />
                <Route path="call-room" element={<CallRoomControl />} />
                <Route path="ranking" element={<SwimmersRanking />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="feedback" element={<Feedback />} />
                <Route path="partners" element={<Partners />} />
                <Route path="api-docs" element={<APIDocs />} />
                <Route path="organizations" element={<Organizations />} />
              </Route>

              {/* Team Portal Routes (Uses AdminLayout for Sidebar but distinct base path) */}
              <Route element={<AdminLayout />}>
                <Route path="/portal/teams" element={<TeamPortalGateway />} />
                <Route path="/portal/teams/:teamId" element={<TeamPortalDashboard />} />
              </Route>

              <Route path="/staff" element={<ErrorBoundary><StaffLayout /></ErrorBoundary>}>
                <Route index element={<Navigate to="/staff/dashboard" replace />} />
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="search" element={<StaffSearch />} />
                <Route path="settings" element={<StaffSettings />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
              </BackgroundProvider>
            </LayoutProvider>
          </ThemeProvider>
        </AuthProvider>
        </BrandingProvider>
      </ToastProvider>
    </Router>
  );
}
