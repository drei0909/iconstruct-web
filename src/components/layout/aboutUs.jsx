

// ── Swap null → your imported photo once you have the files ──
 import photo1 from "../../assets/team/member1.jpg";
 import photo2 from "../../assets/team/member1.jpg";
 import photo3 from "../../assets/team/member1.jpg";
 import photo4 from "../../assets/team/member1.jpg";

const team = [
  {
    number: "01",
    name: "Project Lead",
    role: "System Architecture & Backend Development",
    photo: photo1, // replace with photo1
  },
  {
    number: "02",
    name: "UI/UX Designer",
    role: "Interface Design & Frontend Development",
    photo: photo1, // replace with photo2
  },
  {
    number: "03",
    name: "Database Engineer",
    role: "Data Modeling & System Integration",
    photo: photo1, // replace with photo3
  },
  {
    number: "04",
    name: "QA & Documentation",
    role: "Testing, Research & Technical Writing",
    photo: photo1, // replace with photo4
  },
];

const stats = [
  { number: "98%",  label: "Estimate Accuracy" },
  { number: "2026", label: "Year Founded"       },
];

export default function AboutUs() {
  return (
    <div className="about-page">
      <div className="container">

        {/* ── Hero Banner ── */}
        <div className="about-hero">
          <div className="about-hero-left">
            <div className="about-eyebrow">
              <span className="about-eyebrow-line" />
              About Us
              <span className="about-eyebrow-line" />
            </div>
            <h1 className="about-hero-title">
              Building Smarter<br />
              <em>Construction.</em>
            </h1>
            <p className="about-hero-text">
              iConstruct is a smart construction support system designed to
              help builders plan projects more efficiently — from material
              estimation to trusted supplier connections.
            </p>
          </div>
          <div className="about-stats-row">
            {stats.map((s, i) => (
              <div className="about-stat" key={i}>
                <span className="about-stat-num">{s.number}</span>
                <span className="about-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mission / Vision ── */}
        <div className="about-two-col">
          <div className="about-card">
            <div className="about-card-num">01</div>
            <h3 className="about-card-title">Our Mission</h3>
            <p className="about-card-text">
              To empower Filipino builders, contractors, and hardware shop
              owners with a reliable digital platform that simplifies
              construction planning, reduces material waste, and builds
              stronger supplier relationships across the industry.
            </p>
            <div className="about-card-line" />
          </div>
          <div className="about-card">
            <div className="about-card-num">02</div>
            <h3 className="about-card-title">Our Vision</h3>
            <p className="about-card-text">
              To become the leading construction support platform in the
              Philippines — a trusted bridge between builders and suppliers
              that drives smarter, faster, and more cost-effective
              construction projects nationwide.
            </p>
            <div className="about-card-line" />
          </div>
        </div>

        {/* ── Capstone Banner ── */}
        <div className="about-capstone">
          <div className="about-capstone-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.9)"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              width="30" height="30">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <div className="about-capstone-body">
            <p className="about-capstone-label">Academic Project</p>
            <h4 className="about-capstone-title">
              BS Information Technology Capstone — National University Lipa
            </h4>
            <p className="about-capstone-text">
              iConstruct was developed as a capstone project for the Bachelor
              of Science in Information Technology program at National
              University – Lipa, combining academic research with real-world
              construction industry needs.
            </p>
          </div>
        </div>

        {/* ── Team ── */}
        <div className="about-team-section">
          <div className="about-team-eyebrow">
            <span className="about-eyebrow-line" />
            Meet the Team
            <span className="about-eyebrow-line" />
          </div>
          <h2 className="about-team-title">
            The Developers Behind<br />
            <em>iConstruct</em>
          </h2>
          <p className="about-team-sub">
            A team of passionate IT students from National University – Lipa.
          </p>

          <div className="about-team-grid">
            {team.map((member, i) => (
              <div className="about-member-card" key={i}>

                {/* Photo — 1:1 square */}
                <div className="about-member-photo">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.name}
                      className="about-member-img"
                    />
                  ) : (
                    <div className="about-member-placeholder">
                      <svg viewBox="0 0 24 24" fill="none"
                        stroke="rgba(21,70,101,0.3)"
                        strokeWidth="1.5" strokeLinecap="round"
                        width="36" height="36">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                      <span className="about-placeholder-hint">Add photo</span>
                    </div>
                  )}
                  <div className="about-photo-overlay">
                    <span className="about-photo-num">{member.number}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="about-member-body">
                  <h5 className="about-member-name">{member.name}</h5>
                  <p className="about-member-role">{member.role}</p>
                  <div className="about-member-line" />
                </div>

              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}