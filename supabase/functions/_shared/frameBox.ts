/**
 * The area each timelapse picture covers: the field plus a wide margin of
 * the land around it, so the picture always fills the map box on any
 * screen shape (the map is wider than it is tall on a computer). At least
 * 400 m by 250 m, so even a tiny field has neighbouring land for context.
 */
const M_PER_DEG_LAT = 111_320;

export function frameBox(polygon: GeoJSON.Polygon) {
  const pts = polygon.coordinates[0];
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const west = Math.min(...lons), east = Math.max(...lons);
  const south = Math.min(...lats), north = Math.max(...lats);
  const cLat = (south + north) / 2, cLon = (west + east) / 2;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180);

  const fieldSide = Math.max((east - west) * mPerDegLon, (north - south) * M_PER_DEG_LAT);
  const widthM = Math.max(fieldSide * 8, 400);
  const heightM = Math.max(fieldSide * 5, 250);
  const dLon = widthM / 2 / mPerDegLon;
  const dLat = heightM / 2 / M_PER_DEG_LAT;
  return { west: cLon - dLon, east: cLon + dLon, south: cLat - dLat, north: cLat + dLat, widthM, heightM };
}
