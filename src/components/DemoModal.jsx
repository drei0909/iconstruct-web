// src/components/DemoModal.jsx
// Plays the shop-registration demo. Video loads only after the user clicks Play.

import { useEffect, useRef, useState } from "react";

/** File: public/demos/shop-registration-demo.mp4 */
export const DEMO_VIDEO_SRC = "/demos/shop-registration-demo.mp4";

export default function DemoModal({ open, onClose, src = DEMO_VIDEO_SRC }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFailed(false);
      setStarted(false);
      setLoading(false);
      return undefined;
    }

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, [open, onClose]);

  const startPlayback = () => {
    setFailed(false);
    setStarted(true);
    setLoading(true);
  };

  useEffect(() => {
    if (!open || !started || failed || !videoRef.current) return;
    const el = videoRef.current;
    el.src = src;
    el.load();
    const play = el.play();
    if (play && typeof play.catch === "function") {
      play.catch(() => setLoading(false));
    }
  }, [open, started, failed, src]);

  if (!open) return null;

  return (
    <div
      className="demo-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Shop registration demo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="demo-modal-card">
        <div className="demo-modal-head">
          <div>
            <div className="demo-modal-eyebrow">Shop Registration</div>
            <h2 className="demo-modal-title">Watch how shops register on iConstruct</h2>
          </div>
          <button
            type="button"
            className="demo-modal-close"
            onClick={onClose}
            aria-label="Close demo"
          >
            ×
          </button>
        </div>

        <div className="demo-modal-body">
          {failed ? (
            <div className="demo-modal-empty">
              <p>Demo video not found yet.</p>
              <p className="demo-modal-empty-hint">
                Put your recording at{" "}
                <code>public/demos/shop-registration-demo.mp4</code>, then refresh.
              </p>
            </div>
          ) : !started ? (
            <div className="demo-modal-empty">
              <p>Shop registration walkthrough</p>
              <button type="button" className="demo-modal-play" onClick={startPlayback}>
                ▷ Play demo
              </button>
            </div>
          ) : (
            <div className="demo-modal-player">
              {loading && (
                <div className="demo-modal-loading" aria-live="polite">
                  Loading demo…
                </div>
              )}
              <video
                ref={videoRef}
                className="demo-modal-video"
                controls
                playsInline
                preload="none"
                onWaiting={() => setLoading(true)}
                onPlaying={() => setLoading(false)}
                onCanPlay={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              >
                Your browser does not support video playback.
              </video>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
