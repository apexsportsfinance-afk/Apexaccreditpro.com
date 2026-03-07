import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./contexts/AuthContext";
import ScrollToTop from "./components/layout/ScrollToTop";
import AdminLayout from "./components/layout/AdminLayout";
import { Loader2 } from "lucide-react";

import Login from "./pages/public/Login";
import Home from "./pages/public/Home";
import Register from "./pages/public/Register";
import VerifyAccreditation from "./pages/public/VerifyAccreditation";

const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Events = lazy(() => import("./pages/admin/Events"));
const Accreditations = lazy(() => import("./pages/admin/Accreditations"));
const Zones = lazy(() => import("./pages/admin/Zones"));
const Users = lazy(() => import("./pages/admin/Users"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const QRSystem = lazy(() => import("./pages/admin/QRSystem"));

const PageLoader = () => (
  <div id="app_pageloader" className="flex items-center justify-center min-h-screen bg-swim-deep">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
      <p className="text-lg text-slate-400 font-extralight">Loading...</p>
    </div>
  </div>
);

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register/:slug" element={<Register />} />
            <Route path="/verify/:id" element={<VerifyAccreditation />} />
            <Route path="/accreditation/:id" element={<VerifyAccreditation />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={
                <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
              } />
              <Route path="events" element={
                <Suspense fallback={<PageLoader />}><Events /></Suspense>
              } />
              <Route path="accreditations" element={
                <Suspense fallback={<PageLoader />}><Accreditations /></Suspense>
              } />
              <Route path="zones" element={
                <Suspense fallback={<PageLoader />}><Zones /></Suspense>
              } />
              <Route path="qr-system" element={
                <Suspense fallback={<PageLoader />}><QRSystem /></Suspense>
              } />
              <Route path="users" element={
                <Suspense fallback={<PageLoader />}><Users /></Suspense>
              } />
              <Route path="settings" element={
                <Suspense fallback={<PageLoader />}><Settings /></Suspense>
              } />
              <Route path="audit" element={
                <Suspense fallback={<PageLoader />}><AuditLog /></Suspense>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
