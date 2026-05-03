import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// ── ADD THIS IMPORT ──────────────────────────────────────────────────────────
import MaintenanceGate from "./components/MaintenanceGate";

// Layout
import Layout from "./components/layout/Layout";

// Public pages
import HomePage     from "./views/public/HomePage";
import LoginPage    from "./views/public/LoginPage";
import RegisterPage from "./views/public/RegisterPage";

// Layout pages
import FAQs      from "./components/layout/faqs";
import AboutUs   from "./components/layout/aboutUs";
import ContactUs from "./components/layout/contactUs";

// Shop pages
import PaymentSuccessPage from "./views/shop/PaymentSuccessPage";

// Admin pages
import AdminLoginPage     from "./views/admin/AdminLoginPage";
import AdminDashboardPage from "./views/admin/AdminDashboardPage";

// Routes
import AdminRoute          from "./routes/AdminRoute";
import ShopDashboardRouter from "./routes/ShopDashboardRouter";

export default function App() {
  return (
    <Router>
      {/* ── WRAP EVERYTHING IN MaintenanceGate ─────────────────────────────
          Admins (/admin and /admin/dashboard) bypass maintenance automatically.
          All other routes show the maintenance page when mode is ON.
      ──────────────────────────────────────────────────────────────────── */}
      <MaintenanceGate>
        <Routes>

          {/* Public routes */}
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/"           element={<HomePage />} />
                  <Route path="/login"      element={<LoginPage />} />
                  <Route path="/register"   element={<RegisterPage />} />
                  <Route path="/faqs"       element={<FAQs />} />
                  <Route path="/about"      element={<AboutUs />} />
                  <Route path="/contact-us" element={<ContactUs />} />
                </Routes>
              </Layout>
            }
          />

          {/* Admin routes — admins bypass maintenance automatically */}
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />

          {/* Shop dashboard */}
          <Route path="/shop/dashboard"       element={<ShopDashboardRouter />} />
          <Route path="/shop/payment-success" element={<PaymentSuccessPage />} />

        </Routes>
      </MaintenanceGate>
    </Router>
  );
}