import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import ScrollToTop from "./components/layout/ScrollToTop";
import AdminLayout from "./components/layout/AdminLayout";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";

const Register = React.lazy(() => import("./pages/public/Register"));
const VerifyAccreditation = React.lazy(() => import("./pages/public/VerifyAccreditation"));
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard"));
const Accreditations = React.lazy(() => import("./pages/admin/Accreditations"));
const Events = React.lazy(() => import("./pages/admin/Events"));
const Zones = React.lazy(() => import("./pages/admin/Zones"));
const Users = React.lazy(() => import("./pages/admin/Users"));
const AuditLog = React.lazy(() => import("./pages/admin/AuditLog"));
const Settings = React.lazy(() => import("./pages/admin/Settings"));

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin w-10 h-10 border-3 border-cyan-400 border-t-transparent rounded-full" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register/:slug" element={<Register />} />
              <Route path="/verify/:id" element={<VerifyAccreditation />} />
              <Route path="/accreditation/:id" element={<VerifyAccreditation />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="accreditations" element={<Accreditations />} />
                <Route path="events" element={<Events />} />
                <Route path="zones" element={<Zones />} />
                <Route path="users" element={<Users />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
