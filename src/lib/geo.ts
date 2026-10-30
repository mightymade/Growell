export function polygonCentroid(polygon: GeoJSON.Polygon): { lat: number; lon: number } {
  const ring = polygon.coordinates[0]; // exterior ring, [lon, lat] pairs, last point repeats the first
  const points = ring.slice(0, -1);
  const lon = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { lat, lon };
}
