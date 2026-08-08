import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Fonts first (defines --font-ui / --font-display / --font-base)
import "./style/fonts/fonts.css";
import "./style/global.css";
import "./style/responsive.css";

// Bootstrap once via npm (do not also load CDN in index.html)
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
