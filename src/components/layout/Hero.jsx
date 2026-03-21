import { useState, useEffect, useRef } from "react";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80",
    tag: "Material Estimation",
    headline: "Build Smarter,",
    highlight: "Cost Less.",
    sub: "Accurately estimate every material before you break ground.",
  },
  {
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1600&q=80",
    tag: "Project Management",
    headline: "Plan Every",
    highlight: "Detail.",
    sub: "Track timelines, budgets, and milestones all in one place.",
  },
  {
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&q=80",
    tag: "Supplier Network",
    headline: "Trusted Hardware,",
    highlight: "Delivered.",
    sub: "Connect with verified local suppliers and get the best prices.",
  },
];

const DURATION = 6000;

export default function Hero() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(null);

  const goTo = (index) => {
    if (animating || index === current) return;
    setPrev(current);
    setAnimating(true);
    setCurrent(index);
    setProgress(0);
    startTimeRef.current = performance.now();
    setTimeout(() => {
      setPrev(null);
      setAnimating(false);
    }, 900);
  };

  useEffect(() => {
    slides.forEach((s) => {
      const img = new Image();
      img.src = s.image;
    });
  }, []);

  useEffect(() => {
    startTimeRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startTimeRef.current;
      const p = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(p);
      if (elapsed < DURATION) {
        progressRef.current = requestAnimationFrame(tick);
      }
    };
    progressRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(() => {
      goTo((current + 1) % slides.length);
    }, DURATION);

    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(progressRef.current);
    };
  }, [current]);

  const slide = slides[current];
  const prevSlide = prev !== null ? slides[prev] : null;

  return (
    <>
      

      <section className="hero-root">

        {/* Previous bg (exit) */}
        {prevSlide && (
          <div
            className="hero-bg exit"
            style={{ backgroundImage: `url(${prevSlide.image})` }}
          />
        )}

        {/* Current bg (enter) */}
        <div
          key={current}
          className={`hero-bg ${animating ? "enter" : ""}`}
          style={{ backgroundImage: `url(${slide.image})` }}
        />

        <div className="hero-overlay-dark" />
        <div className="hero-overlay-bottom" />
        <div className="hero-accent-band" />
        <div className="hero-beige-strip" />

        {/* Main content */}
        <div className="hero-content-wrap">
          <div className="hero-inner" key={current}>
            <div className="hero-tag">
              <span className="hero-tag-dot" />
              {slide.tag}
            </div>

            <h1 className="hero-headline">{slide.headline}</h1>
            <span className="hero-headline-highlight">{slide.highlight}</span>

            <p className="hero-sub">{slide.sub}</p>

            <div className="hero-actions">
              <a href="/register" className="hero-btn-primary">
                Get Started Free
                <span className="hero-btn-arrow">→</span>
              </a>
              <a href="/demo" className="hero-btn-ghost">
                ▷ &nbsp;Watch Demo
              </a>
            </div>
          </div>
        </div>

       {/* Stats bar 
        <div className="hero-stats">
          <div className="hero-stat-item">
            <span className="hero-stat-num">2,400+</span>
            <span className="hero-stat-label">Projects Built</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat-item">
            <span className="hero-stat-num">98%</span>
            <span className="hero-stat-label">Estimate Accuracy</span>
          </div>
          <div className="hero-stat-divider" />
          <div className="hero-stat-item">
            <span className="hero-stat-num">500+</span>
            <span className="hero-stat-label">Verified Suppliers</span>
          </div>
        </div> */}

        {/* Slide controls */}
        <div className="hero-controls">
          <span className="hero-slide-count">
            0{current + 1} / 0{slides.length}
          </span>
          <div className="hero-dots">
            {slides.map((_, i) => {
              const isActive = i === current;
              const circumference = 88;
              const offset = isActive
                ? circumference - (progress / 100) * circumference
                : circumference;
              return (
                <div
                  key={i}
                  className={`hero-dot-wrap ${isActive ? "active" : ""}`}
                  onClick={() => goTo(i)}
                >
                  <svg className="hero-dot-svg" viewBox="0 0 32 32">
                    <circle className="hero-dot-track" cx="16" cy="16" r="14" />
                    {isActive && (
                      <circle
                        className="hero-dot-progress"
                        cx="16"
                        cy="16"
                        r="14"
                        style={{ strokeDashoffset: offset }}
                      />
                    )}
                  </svg>
                  <span className="hero-dot-inner" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll cue */}
        <div className="hero-scroll-cue">
          <span className="hero-scroll-text">Scroll</span>
          <div className="hero-scroll-line" />
        </div>
      </section>
    </>
  );
}
