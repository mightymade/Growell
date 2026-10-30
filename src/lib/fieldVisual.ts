import { WheatIcon, SproutIcon, TreeIcon, FlowerIcon, LeafIcon } from "../components/icons";
import type { IconProps } from "../components/icons";

/**
 * A crop-appropriate icon and a stable colour for a field, so fields no
 * longer all look identical in a list. The icon follows the crop family
 * (grain, legume, perennial, root, or unknown); the colour is derived from
 * the field's own id, so two fields with the same crop still look distinct,
 * and the same field always looks the same rather than changing on every
 * render or reload.
 */
export type FieldVisual = {
  Icon: (props: IconProps) => JSX.Element;
  bg: string;
  fg: string;
};

const CROP_ICON: Record<string, FieldVisual["Icon"]> = {
  maize: WheatIcon,
  rice: WheatIcon,
  beans: SproutIcon,
  groundnuts: SproutIcon,
  coffee: TreeIcon,
  banana: TreeIcon,
  cassava: FlowerIcon,
};

const PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "bg-growth-100", fg: "text-growth-700" },
  { bg: "bg-sky-100", fg: "text-sky-700" },
  { bg: "bg-laterite-100", fg: "text-laterite-700" },
  { bg: "bg-parchment-dark", fg: "text-ink/70" },
];

/** A small, deterministic string hash (djb2). Same input, same output,
 *  every time and on every device — unlike Math.random(). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

export function fieldVisual(fieldId: string, cropType: string | null | undefined): FieldVisual {
  const Icon = (cropType && CROP_ICON[cropType.trim().toLowerCase()]) || LeafIcon;
  const { bg, fg } = PALETTE[hash(fieldId) % PALETTE.length];
  return { Icon, bg, fg };
}
