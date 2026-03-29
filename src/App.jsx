  import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
  import Layout from "./components/layout/Layout";
  import Home from "./views/Home";
  import Login from "./views/Login";
  import Register from "./views/Register";
  import FAQs from "./components/layout/faqs";
  import AboutUs from "./components/layout/aboutUs";
  import ContactUs from "./components/layout/contactUs";
  import AdminLogin from "./components/forms/AdminLogin";
  import AdminDashboard from "./components/layout/AdminDashboard";
  import AdminRoute from "./views/AdminRoute";
  import ShopDashboardRouter from "./views/shopdashboardrouter";

  export default function App() {
    return (
      <Router>
        <Routes>
          {/* Public routes wrapped in Layout */}
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/faqs" element={<FAQs />} />
                  <Route path="/about" element={<AboutUs />} />
                  <Route path="/contact-us" element={<ContactUs />} />
                </Routes>
              </Layout>
            }
          />

          {/* Admin routes — no Layout wrapper */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />


                  <Route path="/dashboard" element={<ShopDashboardRouter />} /> {/* ← add this */}

        </Routes>
      </Router>
    );
  }
