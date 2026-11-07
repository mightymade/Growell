// Crops grown in Uganda, with roughly how long each takes from planting to
// harvest. ONE list, used by both the web app (src/lib/cropStages.ts) and
// the daily satellite job (supabase/functions/_shared/cropStages.ts), so
// they can never disagree. This file must stay plain data: no imports.
//
// The numbers are typical for common varieties grown in Uganda. Real
// fields vary with the variety, the season, altitude and rain, so the app
// always calls them estimates.
//
// days: planting (or transplanting) to harvest, for seasonal crops.
// perennial: true for trees, bushes and long-lived plants. For these, days
//   is the time from planting to the FIRST harvest; after that the crop
//   keeps producing, so there is no single harvest date.
// aka: other names farmers use (Luganda and common English), for search.

export type CropGroup =
  | "Cereals"
  | "Beans and pulses"
  | "Roots and tubers"
  | "Vegetables"
  | "Bananas"
  | "Fruits"
  | "Cash crops"
  | "Oil crops"
  | "Fodder";

export type CropInfo = {
  name: string;
  group: CropGroup;
  days: number;
  perennial?: boolean;
  aka?: string[];
};

export const UGANDA_CROPS: CropInfo[] = [
  // Cereals
  { name: "Maize", group: "Cereals", days: 120, aka: ["corn", "kasooli"] },
  { name: "Sorghum", group: "Cereals", days: 120, aka: ["mugusa"] },
  { name: "Finger millet", group: "Cereals", days: 120, aka: ["millet", "bulo", "obulo"] },
  { name: "Pearl millet", group: "Cereals", days: 90, aka: ["bulrush millet"] },
  { name: "Rice", group: "Cereals", days: 120, aka: ["upland rice", "nerica", "paddy", "muceere"] },
  { name: "Wheat", group: "Cereals", days: 120 },
  { name: "Barley", group: "Cereals", days: 110 },

  // Beans and pulses
  { name: "Beans", group: "Beans and pulses", days: 75, aka: ["common beans", "bush beans", "bijanjaalo", "ebijanjaalo"] },
  { name: "Climbing beans", group: "Beans and pulses", days: 100 },
  { name: "Groundnuts", group: "Beans and pulses", days: 100, aka: ["peanuts", "binyebwa", "ebinyebwa"] },
  { name: "Soybeans", group: "Beans and pulses", days: 110, aka: ["soya", "soy"] },
  { name: "Cowpeas", group: "Beans and pulses", days: 75, aka: ["boo", "black-eyed peas"] },
  { name: "Green gram", group: "Beans and pulses", days: 70, aka: ["mung beans", "choroko"] },
  { name: "Pigeon peas", group: "Beans and pulses", days: 180, aka: ["mpiifirifiri"] },
  { name: "Field peas", group: "Beans and pulses", days: 100, aka: ["peas", "mpindi"] },
  { name: "Chickpeas", group: "Beans and pulses", days: 100 },
  { name: "Bambara groundnuts", group: "Beans and pulses", days: 120 },
  { name: "Lablab beans", group: "Beans and pulses", days: 120, aka: ["lablab", "dolichos"] },

  // Roots and tubers
  { name: "Cassava", group: "Roots and tubers", days: 300, aka: ["muwogo", "manioc"] },
  { name: "Sweet potatoes", group: "Roots and tubers", days: 120, aka: ["lumonde", "orange sweet potato"] },
  { name: "Irish potatoes", group: "Roots and tubers", days: 100, aka: ["potatoes"] },
  { name: "Yams", group: "Roots and tubers", days: 270, aka: ["balugu"] },
  { name: "Cocoyams", group: "Roots and tubers", days: 270, aka: ["taro", "mayuni"] },

  // Vegetables
  { name: "Tomatoes", group: "Vegetables", days: 100, aka: ["nyaanya", "ennyaanya"] },
  { name: "Cabbages", group: "Vegetables", days: 90, aka: ["cabbage", "kabbeeji"] },
  { name: "Onions", group: "Vegetables", days: 120, aka: ["onion", "bitungulu", "katunguluccumu"] },
  { name: "Carrots", group: "Vegetables", days: 90, aka: ["carrot"] },
  { name: "Sukuma wiki", group: "Vegetables", days: 60, aka: ["kale", "collard greens"] },
  { name: "Amaranth", group: "Vegetables", days: 35, aka: ["doodo", "dodo"] },
  { name: "Nakati", group: "Vegetables", days: 40, aka: ["african eggplant leaves"] },
  { name: "Garden eggs", group: "Vegetables", days: 100, aka: ["entula", "african eggplant"] },
  { name: "Eggplants", group: "Vegetables", days: 100, aka: ["eggplant", "brinjal", "biringanya"] },
  { name: "Spinach", group: "Vegetables", days: 45 },
  { name: "Green peppers", group: "Vegetables", days: 90, aka: ["sweet pepper", "capsicum", "pilipili"] },
  { name: "Hot peppers", group: "Vegetables", days: 100, aka: ["chilli", "chili", "kamulali", "kaamulali"] },
  { name: "Okra", group: "Vegetables", days: 60, aka: ["lady's fingers", "bamia"] },
  { name: "French beans", group: "Vegetables", days: 60, aka: ["green beans"] },
  { name: "Watermelons", group: "Vegetables", days: 85, aka: ["watermelon"] },
  { name: "Pumpkins", group: "Vegetables", days: 110, aka: ["pumpkin", "ensujju", "squash"] },
  { name: "Cucumbers", group: "Vegetables", days: 60, aka: ["cucumber"] },
  { name: "Lettuce", group: "Vegetables", days: 60 },
  { name: "Garlic", group: "Vegetables", days: 150 },
  { name: "Beetroot", group: "Vegetables", days: 70, aka: ["beets"] },

  // Bananas
  { name: "Banana", group: "Bananas", days: 450, perennial: true, aka: ["matooke", "cooking banana"] },
  { name: "Sweet bananas", group: "Bananas", days: 420, perennial: true, aka: ["bogoya", "ndiizi"] },
  { name: "Plantain", group: "Bananas", days: 450, perennial: true, aka: ["gonja"] },

  // Fruits
  { name: "Pineapples", group: "Fruits", days: 540, aka: ["pineapple", "nnanansi", "ennanansi"] },
  { name: "Passion fruit", group: "Fruits", days: 270, perennial: true, aka: ["butunda", "passion"] },
  { name: "Pawpaw", group: "Fruits", days: 300, perennial: true, aka: ["papaya", "papaali"] },
  { name: "Mangoes", group: "Fruits", days: 1095, perennial: true, aka: ["mango", "muyembe"] },
  { name: "Avocados", group: "Fruits", days: 1095, perennial: true, aka: ["avocado", "ovakedo"] },
  { name: "Oranges", group: "Fruits", days: 1095, perennial: true, aka: ["orange", "citrus", "machungwa", "mangada"] },
  { name: "Jackfruit", group: "Fruits", days: 1460, perennial: true, aka: ["fene", "ffene"] },
  { name: "Guavas", group: "Fruits", days: 900, perennial: true, aka: ["guava", "mapeera"] },

  // Cash crops
  { name: "Coffee", group: "Cash crops", days: 1095, perennial: true, aka: ["robusta", "arabica", "mmwanyi"] },
  { name: "Tea", group: "Cash crops", days: 1095, perennial: true, aka: ["chai"] },
  { name: "Cocoa", group: "Cash crops", days: 1095, perennial: true, aka: ["cacao"] },
  { name: "Vanilla", group: "Cash crops", days: 1095, perennial: true },
  { name: "Cotton", group: "Cash crops", days: 150, aka: ["pamba"] },
  { name: "Tobacco", group: "Cash crops", days: 120, aka: ["taaba"] },
  { name: "Sugarcane", group: "Cash crops", days: 540, aka: ["sugar cane", "bikajjo", "ebikajjo"] },
  { name: "Macadamia", group: "Cash crops", days: 1825, perennial: true, aka: ["macadamia nuts"] },

  // Oil crops
  { name: "Sunflower", group: "Oil crops", days: 100, aka: ["sunflowers"] },
  { name: "Simsim", group: "Oil crops", days: 100, aka: ["sesame", "sesame seed"] },
  { name: "Oil palm", group: "Oil crops", days: 1095, perennial: true, aka: ["palm oil"] },

  // Fodder
  { name: "Napier grass", group: "Fodder", days: 90, perennial: true, aka: ["elephant grass", "fodder"] },
];

/** Lookup by name, ignoring upper or lower case. */
export function findCrop(name: string | null | undefined): CropInfo | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return UGANDA_CROPS.find((c) => c.name.toLowerCase() === n);
}
