import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const features = [
  {
    
    tag: "Visibility",
    title: "Get More Customers",
    description:
      "Contractors and builders can easily find your hardware shop when they need construction materials.",
  },
  {
    
    tag: "Estimation",
    title: "Smart Material Estimation",
    description:
      "Contractors calculate materials using iConstruct, and your shop becomes their trusted supplier.",
  },
  {
    
    tag: "Costing",
    title: "Accurate Cost Calculation",
    description:
      "Help customers estimate project costs using real hardware prices from registered shops.",
  },
  {
   
    tag: "Marketing",
    title: "Promote Your Hardware Shop",
    description:
      "Show your shop to contractors, builders, and homeowners looking for reliable suppliers.",
  },
  {
   
    tag: "Trust",
    title: "Verified Business Platform",
    description:
      "Only approved hardware shops are listed, creating a trusted environment for construction partners.",
  },
  {
    
    tag: "Management",
    title: "Easy Shop Management",
    description:
      "Manage your shop profile, update materials, and connect with customers through one platform.",
  },
];

export default function Features() {
  return (
    <>
      <section className="ft-section">
        <div className="container">

          {/* Header */}
          <div className="ft-header">
            <div className="ft-eyebrow">
              <span className="ft-eyebrow-line" />
              Platform Features
              <span className="ft-eyebrow-line" />
            </div>
            <h2 className="ft-title">
              Why Register Your Shop<br />
              with <span>iConstruct</span>?
            </h2>
            <p className="ft-subtitle">
              Everything you need to grow your hardware business and become
              the go-to supplier for builders and contractors.
            </p>
          </div>

          {/* Swiper */}
          <div className="ft-swiper-wrap">
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              spaceBetween={24}
              slidesPerView={3}
              navigation
              pagination={{ clickable: true }}
              autoplay={{
                delay: 4000,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              breakpoints={{
                0:   { slidesPerView: 1 },
                640: { slidesPerView: 2, spaceBetween: 16 },
                992: { slidesPerView: 3, spaceBetween: 24 },
              }}
            >
              {features.map((f, i) => (
                <SwiperSlide key={i} style={{ height: "auto" }}>
                  <div className="ft-card">
                    <div className="ft-icon-wrap">{f.icon}</div>
                    <span className="ft-tag">{f.tag}</span>
                    <h4 className="ft-card-title">{f.title}</h4>
                    <p className="ft-card-desc">{f.description}</p>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          {/* CTA strip */}
          <div className="ft-cta">
            <div className="ft-cta-inner">
              <p className="ft-cta-text">Ready to grow your hardware business?</p>
              <a href="/register" className="ft-cta-btn">
                Register Your Shop →
              </a>
            </div>
          </div>

        </div>
      </section>
    </>
  );
}