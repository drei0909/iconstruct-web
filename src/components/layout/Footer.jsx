import { Link, NavLink } from "react-router-dom";
import logo from "../../assets/logo/logo2.png";

export default function Footer() {
  return (
    <>
      

      <footer className="fo-root">
        <div className="fo-top-bar" />

        <div className="fo-main">
          <div className="container">
            <div className="fo-grid">

              {/* Brand column */}
              <div className="fo-brand-col">
                <img src={logo} alt="iConstruct" className="fo-logo" />
                <p className="fo-brand-text">
                  Smart Construction Support System for modern project
                  planning — estimate materials, manage costs, and connect
                  with trusted hardware suppliers.
                </p>
                {/* <div className="fo-socials">
                  <a href="#" className="fo-social-btn" aria-label="Facebook"></a>
                  <a href="#" className="fo-social-btn" aria-label="Instagram"></a>
                  <a href="#" className="fo-social-btn" aria-label="Twitter"></a>
                  <a href="#" className="fo-social-btn" aria-label="LinkedIn"></a>
                </div> */}
              </div>

              {/* Navigation */}
              <div>
                <h6 className="fo-col-title">Navigate</h6>
                <ul className="fo-links">
                  <li><Link to="/"           className="fo-link">Home</Link></li>
                  <li><Link to="/about"       className="fo-link">About Us</Link></li>
                  <li><Link to="/faqs"        className="fo-link">FAQs</Link></li>
                  <li><Link to="/contact-us"  className="fo-link">Contact Us</Link></li>
                </ul>
              </div>

              {/* Platform */}
              <div>
                <h6 className="fo-col-title">Platform</h6>
                <ul className="fo-links">
                  <li><Link to="/register"  className="fo-link">Register Shop</Link></li>
                  <li><Link to="/login"     className="fo-link">Sign In</Link></li>
                  <li><a href="#"           className="fo-link">How It Works</a></li>
                  <li><a href="#"           className="fo-link">Pricing</a></li>
                </ul>
              </div>

              {/* Download */}
            {/*   <div>
                <h6 className="fo-col-title">Get the App</h6>
                <a href="#" className="fo-download-badge">
                  <span className="fo-badge-icon">▶</span>
                  <span className="fo-badge-text">
                    <span className="fo-badge-sub">Get it on</span>
                    <span className="fo-badge-name">Google Play</span>
                  </span>
                </a>
                <a href="#" className="fo-download-badge">
                  
                  <span className="fo-badge-text">
                   
                  </span>
                </a>
              </div> */}

            </div>

            <div className="fo-divider" />

            {/* Bottom bar */}
            <div className="fo-bottom">
              <p className="fo-copy">
                © 2026 <span>iConstruct</span>. All rights reserved.
              </p>

              <div className="fo-tagline">
                <span className="fo-tagline-dot" />
                Built for Filipino Builders
              </div>

              <div className="fo-bottom-links">
                <a href="#" className="fo-bottom-link">Privacy Policy</a>
                <a href="#" className="fo-bottom-link">Terms of Service</a>
              </div>
            </div>

          </div>
        </div>
      </footer>
    </>
  );
}
