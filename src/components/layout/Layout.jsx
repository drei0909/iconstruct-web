// src/components/layout/Layout.jsx
import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({ children }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />               {/* Only once */}
      <div className="flex-grow-1">{children}</div>
      <Footer />               {/* Only once */}
    </div>
  );
}