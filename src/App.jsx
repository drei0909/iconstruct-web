import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Layout
import Layout from "./components/layout/Layout";

// Public pages — updated paths
import HomePage     from "./views/public/HomePage";
import LoginPage    from "./views/public/LoginPage";
import RegisterPage from "./views/public/RegisterPage";

// Layout pages — these stay in components/layout
import FAQs      from "./components/layout/faqs";
import AboutUs   from "./components/layout/aboutUs";
import ContactUs from "./components/layout/contactUs";

// Admin pages — updated paths
import AdminLoginPage     from "./views/admin/AdminLoginPage";
import AdminDashboardPage from "./views/admin/AdminDashboardPage";

// Routes — updated paths
import AdminRoute          from "./routes/AdminRoute";
import ShopDashboardRouter from "./routes/ShopDashboardRouter";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* Public routes — wrapped in Layout (Navbar + Footer) */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/"          element={<HomePage />} />
                <Route path="/login"     element={<LoginPage />} />
                <Route path="/register"  element={<RegisterPage />} />
                <Route path="/faqs"      element={<FAQs />} />
                <Route path="/about"     element={<AboutUs />} />
                <Route path="/contact-us" element={<ContactUs />} />
              </Routes>
            </Layout>
          }
        />

        {/* Admin routes — no Layout */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />

        {/* Shop dashboard — no Layout */}
        <Route path="/dashboard" element={<ShopDashboardRouter />} />

      </Routes>
    </Router>
  );
}