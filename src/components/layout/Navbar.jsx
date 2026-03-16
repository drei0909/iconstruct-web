import { Link, NavLink } from "react-router-dom";
import logo from "../../assets/logo/logo.png";

function Navbar() {
  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-custom">
        <div className="container navbar-container">

          {/* Logo */}
          <Link className="navbar-brand" to="/">
            <img src={logo} alt="Logo" className="navbar-logo" />
          </Link>

          {/* Hamburger toggler */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navMenu"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navbar links */}
          <div className="collapse navbar-collapse" id="navMenu">
            <ul className="navbar-nav ms-auto align-items-center">

              <li className="nav-item">
                <button
                  className="nav-link btn btn-link download-btn"
                  data-bs-toggle="modal"
                  data-bs-target="#downloadModal"
                >
                  DOWNLOAD
                </button>
              </li>

              <li className="nav-item">
                <Link className="nav-link" to="/login">
                  SIGN IN
                </Link>
              </li>

              <li className="nav-item">
                <Link className="btn btn-primary" to="/register">
                  SIGN UP
                </Link>
              </li>

            </ul>
          </div>
        </div>
      </nav>

      {/* BUTTON BAR UNDER NAVBAR */}
      <div className="top-buttons">
        <div className="container buttons-container">

          <NavLink to="/" className="top-btn">
            HOME
          </NavLink>

          <NavLink to="/faqs" className="top-btn">
            FAQs
          </NavLink>

          <NavLink to="/about" className="top-btn">
            ABOUT US
          </NavLink>

          <NavLink to="/contact-us" className="top-btn">
            CONTACT US
          </NavLink>

        </div>
      </div>

      {/* Download Modal */}
      <div className="modal fade" id="downloadModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content download-modal">

            <div className="modal-header download-header">
              <img src={logo} alt="iConstruct Logo" className="download-logo"/>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>

            <div className="modal-body text-center">
              <p className="download-text">
                This is the foundation. Download the iConstruct mobile app
                and start connecting your hardware shop today.
              </p>

              <div className="download-buttons">
                <a href="#" className="btn btn-dark store-btn">Google Play</a>
                <a href="#" className="btn btn-dark store-btn">App Store</a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default Navbar;