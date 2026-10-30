import { useState } from "react";
import { fieldVisual } from "../lib/fieldVisual";

/** Crops that have a photo in public/crops/<name>.jpg. */
const CROP_PHOTOS = new Set(["maize", "beans", "cassava", "coffee", "banana", "groundnuts", "rice"]);

/**
 * A small photo of the crop growing on this field, so a farmer recognises
 * each field at a glance. Falls back to the crop icon when the crop is
 * "Other", not set, or its photo is missing.
 */
export default function CropThumb({
  fieldId,
  cropType,
  size = 48,
}: {
  fieldId: string;
  cropType: string | null;
  size?: number;
}) {
  const crop = cropType?.trim().toLowerCase() ?? "";
  const [failed, setFailed] = useState(false);
  const hasPhoto = CROP_PHOTOS.has(crop) && !failed;

  if (hasPhoto) {
    return (
      <img
        src={`/crops/${crop}.jpg`}
        alt={cropType ?? ""}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={(e) => (e.currentTarget.dataset.loaded = "true")}
        className="m-img shrink-0 rounded-lg object-cover ring-1 ring-canopy-900/10 dark:ring-white/10"
        style={{ width: size, height: size }}
      />
    );
  }

  const { Icon, bg, fg } = fieldVisual(fieldId, cropType);
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${bg} ${fg}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.4)} />
    </span>
  );
}
