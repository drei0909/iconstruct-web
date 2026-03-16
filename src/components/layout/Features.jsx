import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

function Features() {
  const features = [
    {
      title: "Get More Customers",
      description:
        "Contractors and builders can easily find your hardware shop when they need construction materials.",
    },
    {
      title: "Smart Material Estimation",
      description:
        "Contractors calculate materials using iConstruct, and your shop becomes their trusted supplier.",
    },
    {
      title: "Accurate Cost Calculation",
      description:
        "Help customers estimate project costs using real hardware prices from registered shops.",
    },
    {
      title: "Promote Your Hardware Shop",
      description:
        "Show your shop to contractors, builders, and homeowners looking for reliable suppliers.",
    },
    {
      title: "Verified Business Platform",
      description:
        "Only approved hardware shops are listed, creating a trusted environment for construction partners.",
    },
    {
      title: "Easy Shop Management",
      description:
        "Manage your shop profile, update materials, and connect with customers through one platform.",
    },
];

  return (
    <section className="features-section">
      <div className="container">
        <h2 className="text-center section-title">
          Why You Should Register Your Shop
        </h2>

        <Swiper
          modules={[Autoplay, Navigation, Pagination]}
          spaceBetween={30}
          slidesPerView={3}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
          breakpoints={{
            0: { slidesPerView: 1 },
            768: { slidesPerView: 2 },
            992: { slidesPerView: 3 },
          }}
        >
          {features.map((feature, index) => (
            <SwiperSlide key={index}>
              <div className="feature-card text-center">
                <h4>{feature.title}</h4>
                <p>{feature.description}</p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

export default Features;