/**
 * Uganda's farming seasons, worked out from WHERE the farmer's fields are.
 *
 * Central, southern, eastern and western Uganda (and everything near the
 * equator) have two rainy seasons: roughly March to May and September to
 * November. From about 3 degrees north (northern Uganda and Karamoja) there
 * is one long rainy season, roughly April to October.
 *
 * This is a general guide built from typical rainfall calendars. Rains can
 * start weeks earlier or later in any year, so the app also uses the weather
 * forecast alongside it.
 */
export type SeasonKind = "dry" | "prepare" | "plant" | "grow" | "harvest";
export type Zone = "bimodal" | "unimodal" | "outside";

export type Phase = {
  kind: SeasonKind;
  season: string;
  title: string;
  summary: string;
  tips: string[];
  from: [number, number]; // [month 1-12, day], inclusive
  to: [number, number];
};

export const KIND_LABEL: Record<SeasonKind, string> = {
  dry: "Dry season",
  prepare: "Get ready",
  plant: "Planting time",
  grow: "Growing",
  harvest: "Harvest time",
};

const A = "Long rains (Season A)";
const B = "Short rains (Season B)";
const DRY = "Dry season";
const RAIN = "Rainy season";

const wait = "Do not plant after one shower. Wait for steady rain over several days.";
const checkGaps = "Check after 7 to 10 days and replant any gaps.";
const growTips = [
  "Weed early and often. Weeds steal water and food from your crop.",
  "Add fertiliser to maize when it is knee high, if you use it.",
  "Dig drainage channels if water stands in the field.",
  "Look for spots, holes or wilting after heavy rain and act early.",
];
const harvestTips = [
  "Harvest on dry days, when pods and cobs are mature.",
  "Dry the crop fully before storing, to stop mould.",
  "Store in clean, dry bags off the ground.",
  "Keep some good seed for the next planting.",
];

const BIMODAL: Phase[] = [
  { kind: "dry", season: DRY, from: [1, 1], to: [2, 14], title: "Dry season: finish up and prepare",
    summary: "There is little rain. Use this time to store your harvest and get your land ready.",
    tips: ["Store harvested crops in clean, dry bags off the ground.", "Clear and dig your fields before the rains.", "Check seed, tools and fertiliser. Buy early, before the rush.", "Keep bananas and coffee mulched to hold moisture."] },
  { kind: "prepare", season: A, from: [2, 15], to: [2, 29], title: "Rains are coming: get ready to plant",
    summary: "The long rains usually start in early March. Prepare now so you can plant as soon as the rain is steady.",
    tips: ["Finish clearing and digging your land now.", "Get good seed ready, and fertiliser if you use it.", "Plan where each crop goes. Avoid the same crop in the same place as last season.", wait] },
  { kind: "plant", season: A, from: [3, 1], to: [4, 15], title: "Planting time: the long rains have started",
    summary: "This is the best time to plant maize, beans and groundnuts.",
    tips: ["Plant when the soil is wet and the rain is steady.", "Plant in rows and keep the right spacing.", checkGaps, "Plant early, so crops finish before the rains stop."] },
  { kind: "grow", season: A, from: [4, 16], to: [5, 31], title: "Rainy season: look after your crops",
    summary: "Your crops are growing. Weeds, pests and too much water are the main risks.", tips: growTips },
  { kind: "harvest", season: A, from: [6, 1], to: [7, 15], title: "Rains are ending: harvest time",
    summary: "Many crops are ready. Harvest on dry days and dry the crop well.",
    tips: [...harvestTips.slice(0, 3), "Start clearing land for the next season."] },
  { kind: "dry", season: DRY, from: [7, 16], to: [8, 10], title: "Short dry spell: rest and prepare",
    summary: "A short break between the two rainy seasons.",
    tips: ["Finish drying and storing the harvest.", "Prepare land for the short rains.", "Water young banana or coffee plants if the soil is dry.", "Check seed and tools for the next planting."] },
  { kind: "prepare", season: B, from: [8, 11], to: [8, 31], title: "Short rains are coming: get ready to plant",
    summary: "The short rains usually start in early September. Get your land and seed ready now.",
    tips: ["Finish clearing and digging your land.", "Choose seed that matures quickly, so it is ready before the dry season.", "Plan crop rotation for this field.", wait] },
  { kind: "plant", season: B, from: [9, 1], to: [9, 30], title: "Planting time: the short rains have started",
    summary: "Plant quick-maturing crops such as beans and short-cycle maize.",
    tips: ["Plant as soon as the rain is steady, because this season is shorter.", "Use varieties that mature quickly.", checkGaps, "Keep weeds down from the start."] },
  { kind: "grow", season: B, from: [10, 1], to: [11, 15], title: "Rainy season: look after your crops",
    summary: "Your crops are growing. Weeds, pests and too much water are the main risks.", tips: growTips },
  { kind: "harvest", season: B, from: [11, 16], to: [12, 31], title: "Rains are ending: harvest and prepare for the dry season",
    summary: "Harvest your crops and dry them well. The dry season follows.",
    tips: [...harvestTips.slice(0, 3), "Mulch banana and coffee to protect them in the dry season."] },
];

const dryNorth = (from: [number, number], to: [number, number]): Phase => ({
  kind: "dry", season: DRY, from, to, title: "Dry season: prepare your land",
  summary: "There is little rain. The rains usually start around mid April.",
  tips: ["Clear and dig your fields before the rains.", "Get seed ready and check your tools.", "Store your harvest safely in dry bags off the ground.", "Plan what each field will grow this year."],
});

const UNIMODAL: Phase[] = [
  dryNorth([1, 1], [3, 15]),
  { kind: "prepare", season: RAIN, from: [3, 16], to: [4, 10], title: "Rains are coming: get ready to plant",
    summary: "The long rains usually begin in April. Prepare now so you can plant as soon as the rain is steady.",
    tips: ["Finish clearing and digging your land.", "Get good seed ready, and fertiliser if you use it.", "Plan where each crop goes, and rotate crops.", wait] },
  { kind: "plant", season: RAIN, from: [4, 11], to: [5, 31], title: "Planting time: the rains have started",
    summary: "There is one long rainy season in the north, so plant in the first weeks to use all of it.",
    tips: ["Plant when the soil is wet and the rain is steady.", "Plant in rows and keep the right spacing.", checkGaps, "Plant early, so crops finish before the rains stop."] },
  { kind: "grow", season: RAIN, from: [6, 1], to: [8, 31], title: "Rainy season: look after your crops",
    summary: "Your crops are growing. Weeds, pests and too much water are the main risks.", tips: growTips },
  { kind: "harvest", season: RAIN, from: [9, 1], to: [11, 30], title: "Rains are ending: harvest time",
    summary: "Many crops are ready. Harvest on dry days and dry the crop well.", tips: harvestTips },
  dryNorth([12, 1], [12, 31]),
];

/** Rough box around Uganda. Outside it, we do not guess. */
export function zoneFor(lat: number, lon: number): { zone: Zone; borderline: boolean } {
  const inUganda = lat >= -1.6 && lat <= 4.4 && lon >= 29.4 && lon <= 35.1;
  if (!inUganda) return { zone: "outside", borderline: false };
  return { zone: lat >= 3 ? "unimodal" : "bimodal", borderline: lat >= 2.5 && lat < 3.5 };
}

export const ZONE_LABEL: Record<Zone, string> = {
  bimodal: "Two rainy seasons a year",
  unimodal: "One long rainy season a year",
  outside: "Outside Uganda",
};

const cmp = (m: number, d: number) => m * 100 + d;
const table = (zone: Zone) => (zone === "unimodal" ? UNIMODAL : BIMODAL);

export function phaseFor(zone: Zone, date: Date): Phase | null {
  if (zone === "outside") return null;
  const v = cmp(date.getMonth() + 1, date.getDate());
  return table(zone).find((p) => v >= cmp(...p.from) && v <= cmp(...p.to)) ?? null;
}

const DAY = 86400000;
const midnight = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** The next different phase, and when it usually starts. */
export function nextPhase(zone: Zone, date: Date): { phase: Phase; start: Date; inDays: number } | null {
  const list = table(zone);
  const cur = phaseFor(zone, date);
  if (zone === "outside" || !cur) return null;
  let i = list.indexOf(cur);
  let nxt = list[(i + 1) % list.length];
  while (nxt.title === cur.title) {
    i = (i + 1) % list.length;
    nxt = list[(i + 1) % list.length];
  }
  let start = new Date(date.getFullYear(), nxt.from[0] - 1, nxt.from[1]);
  if (midnight(start) <= midnight(date)) start = new Date(date.getFullYear() + 1, nxt.from[0] - 1, nxt.from[1]);
  return { phase: nxt, start, inDays: Math.round((midnight(start) - midnight(date)) / DAY) };
}

/** One kind per month (judged on the 15th), for the year-at-a-glance strip. */
export function monthKinds(zone: Zone): SeasonKind[] {
  return Array.from({ length: 12 }, (_, m) => phaseFor(zone, new Date(2001, m, 15))?.kind ?? "dry");
}

export function seasonSummary(zone: Zone): { name: string; plant: string; harvest: string }[] {
  if (zone === "bimodal")
    return [
      { name: "Long rains (Season A)", plant: "March to April", harvest: "June to July" },
      { name: "Short rains (Season B)", plant: "September", harvest: "Late November to December" },
    ];
  if (zone === "unimodal") return [{ name: "Rainy season", plant: "Mid April to May", harvest: "September to November" }];
  return [];
}
