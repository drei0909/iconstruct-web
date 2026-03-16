import { useState, useEffect } from "react";

const heroImages = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c", // small house project
  "https://images.unsplash.com/photo-1554224155-6726b3ff858f", // calculation / planning
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e", // building construction
];

function Hero() {
  const [current, setCurrent] = useState(0);

  // preload images to prevent white flash
  useEffect(() => {
    heroImages.forEach((img) => {
      const image = new Image();
      image.src = img;
    });
  }, []);

  // slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="hero-section text-center text-white"
      style={{
        backgroundImage: `url(${heroImages[current]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "background 1s ease-in-out"
      }}
    >
      <div className="container hero-content">
        <h1 className="hero-title">Build Smarter with iConstruct</h1>

        <p className="hero-subtitle">
          Smart construction support system for estimating materials,
          managing costs, and connecting with trusted hardware suppliers.
        </p>

        <a href="/register" className="btn btn-warning hero-btn">
          Get Started
        </a>
      </div>
    </section>
  );
}

export default Hero;