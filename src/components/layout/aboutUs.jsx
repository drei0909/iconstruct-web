const team = [
  {
    number: "01",
    name: "Project Lead",
    role: "System Architecture & Backend Development",
  },
  {
    number: "02",
    name: "UI/UX Designer",
    role: "Interface Design & Frontend Development",
  },
  {
    number: "03",
    name: "Database Engineer",
    role: "Data Modeling & System Integration",
  },
  {
    number: "04",
    name: "QA & Documentation",
    role: "Testing, Research & Technical Writing",
  },
];

const stats = [
  { number: "98%",    label: "Estimate Accuracy"  },
  { number: "2026",   label: "Year Founded"       },
];

export default function AboutUs() {
  return (
    <>
     
      <div className="about-page">
        <div className="container">

          {/* Hero banner */}
          <div className="about-hero">
            <div className="about-hero-left">
              <div className="about-eyebrow">
                <span className="about-eyebrow-line" />
                About Us
                <span className="about-eyebrow-line" />
              </div>
              <h1 className="about-hero-title">
                Building Smarter<br />
                <span>Construction.</span>
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

          {/* Two-column mission/vision */}
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

          {/* Capstone banner */}
          <div className="about-capstone">
            <div className="about-capstone-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(237,228,212,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
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

          {/* Team */}
          <div>
            <h2 className="about-section-title">Meet the <span>Team</span></h2>
            <p className="about-section-sub">
              The developers behind iConstruct.
            </p>
            <div className="about-team-grid">
              {team.map((member, i) => (
                <div className="about-team-card" key={i}>
                  <span className="about-team-watermark">{member.number}</span>
                  <div className="about-team-num">{member.number}</div>
                  <h5 className="about-team-name">{member.name}</h5>
                  <p className="about-team-role">{member.role}</p>
                  <div className="about-team-line" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
