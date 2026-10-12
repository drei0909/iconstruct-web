// src/components/ui/MaterialPhoto.jsx
// Thumbnail for a project material, from the builder app's photoKey.
// Files live in public/materials/<photoKey>.jpg (copied from the app's
// assets/images/materials/). Only these keys are ever turned into a path,
// so bad or unexpected data can't point the page at some other file.
// When the co-dev adds or renames a photo, add its key here too.

import { useState } from "react";

const PHOTO_KEYS = new Set([
  "cement_bedding",
  "chb",
  "mortar_cement",
  "pvc_pipe",
  "roller_set",
  "sandpaper",
  "silicone",
  "structural_cement",
  "washed_sand",
]);

/** Renders the photo, or `fallback` when the material has no photo (most
 *  don't, and posts made before the app added photoKey have none) or the
 *  file fails to load. */
export default function MaterialPhoto({ photoKey, name = "", size = 44, fallback = null }) {
  const [failed, setFailed] = useState(false);
  const key = String(photoKey || "").trim().toLowerCase();
  if (!key || !PHOTO_KEYS.has(key) || failed) return fallback;
  return (
    <img
      src={`/materials/${key}.jpg`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#E4E9F0" }}
    />
  );
}
