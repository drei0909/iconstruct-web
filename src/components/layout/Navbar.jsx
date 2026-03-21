import { useState, useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../../assets/logo/logo.png";

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!e.target.closest(".nb-collapse") && !e.target.closest(".nb-toggler"))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // Trap focus / close modal on ESC
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setModalOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  return (
    <>
      

      {/* ── Sticky wrapper ── */}
      <div className="nb-root">

        {/* ── Main navbar ── */}
        <nav className={`nb-nav ${scrolled ? "scrolled" : ""}`}>

          <Link className="nb-logo" to="/">
            <img src={logo} alt="iConstruct" />
          </Link>

          {/* Desktop links */}
          <ul className="nb-links">
            <li>
              <button
                className="nb-link"
                onClick={() => setModalOpen(true)}
              >
                Download
              </button>
            </li>

            <li>
              <div className="nb-divider" />
            </li>

            <li>
              <Link className="nb-signin nb-link" to="/login">
                Sign In
              </Link>
            </li>

            <li>
              <Link className="nb-signup" to="/register">
                Sign Up →
              </Link>
            </li>
          </ul>

          {/* Mobile toggler */}
          <button
            className={`nb-toggler ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </nav>

        {/* ── Bottom bar (desktop) ── */}
        <div className={`nb-bar ${scrolled ? "scrolled" : ""}`}>
          <nav className="nb-bar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nb-bar-link${isActive ? " active" : ""}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/faqs"
              className={({ isActive }) => `nb-bar-link${isActive ? " active" : ""}`}
            >
              FAQs
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) => `nb-bar-link${isActive ? " active" : ""}`}
            >
              About Us
            </NavLink>
            <NavLink
              to="/contact-us"
              className={({ isActive }) => `nb-bar-link${isActive ? " active" : ""}`}
            >
              Contact Us
            </NavLink>
          </nav>
        </div>

        {/* ── Mobile menu ── */}
        <div className={`nb-collapse ${menuOpen ? "open" : ""}`}>
          <button className="nb-collapse-link" onClick={() => { setModalOpen(true); setMenuOpen(false); }}>
            Download
          </button>
          <NavLink to="/"         end className="nb-collapse-link" onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/faqs"         className="nb-collapse-link" onClick={() => setMenuOpen(false)}>FAQs</NavLink>
          <NavLink to="/about"        className="nb-collapse-link" onClick={() => setMenuOpen(false)}>About Us</NavLink>
          <NavLink to="/contact-us"   className="nb-collapse-link" onClick={() => setMenuOpen(false)}>Contact Us</NavLink>

          <div className="nb-collapse-actions">
            <Link className="nb-signin" to="/login"    onClick={() => setMenuOpen(false)}>Sign In</Link>
            <Link className="nb-signup" to="/register" onClick={() => setMenuOpen(false)}>Sign Up →</Link>
          </div>
        </div>
      </div>

      {/* ── Download Modal ── */}
      {modalOpen && (
        <div className="nb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="nb-modal" ref={modalRef}>

            <div className="nb-modal-head">
              <img src={logo} alt="iConstruct" />
              <button className="nb-modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>

            <div className="nb-modal-body">
              <div className="nb-modal-icon">📱</div>
              <h3 className="nb-modal-title">Get iConstruct</h3>
              <p className="nb-modal-text">
                Download the iConstruct mobile app and start connecting
                your hardware shop, estimating materials, and managing
                projects — all from your phone.
              </p>
              <div className="nb-modal-btns">
                <a href="#" className="nb-modal-store">
                  <span className="nb-modal-store-sub">Get it on</span>
                  <span className="nb-modal-store-name">▶ Google Play</span>
                </a>
               
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
