import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import ScrollToTop from "./components/layout/ScrollToTop";
import AdminLayout from "./components/layout/AdminLayout";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import VerifyAccreditation from "./pages/public/VerifyAccreditation";

import Dashboard from "./pages/admin/Dashboard";
import Accreditations from "./pages/admin/Accreditations";
import Events from "./pages/admin/Events";
import Zones from "./pages/admin/Zones";
import Users from "./pages/admin/Users";
import AuditLog from "./pages/admin/AuditLog";
import Settings from "./pages/admin/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
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
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
