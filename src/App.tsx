import CustomerAccountPage from "./pages/CustomerAccountPage";
import { useEffect } from "react";
import { loadRentalPrices } from "./hooks/useRentalPrices";
import { AnimatePresence } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import AboutPage from "./pages/AboutPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AgreementPage from "./pages/AgreementPage";
import BookingPage from "./pages/BookingPage";
import ContactPage from "./pages/ContactPage";
import EquipmentDetailPage from "./pages/EquipmentDetailPage";
import EquipmentPage from "./pages/EquipmentPage";
import HomePage from "./pages/HomePage";
import InvoicePage from "./pages/InvoicePage";
import PoliciesPage from "./pages/PoliciesPage";
import RentalRequirementsPage from "./pages/RentalRequirementsPage";

function App() {
  const location = useLocation();
  useEffect(() => {
    void loadRentalPrices();
    const refresh = () => { void loadRentalPrices(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/rental-requirements" element={<RentalRequirementsPage />} />
        <Route path="/account" element={<CustomerAccountPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/agreement/:id"
          element={
            <ProtectedRoute>
              <AgreementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoicePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default App;
