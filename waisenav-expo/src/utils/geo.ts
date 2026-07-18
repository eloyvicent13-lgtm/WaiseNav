export type LatLng = { latitude: number; longitude: number };

const R = 6371000;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la = (a.latitude * Math.PI) / 180;
  const lb = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Prefix sums of segment lengths along a polyline. cum[0] = 0. */
export function cumulativeDistances(coords: LatLng[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i += 1) {
    cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  }
  return cum;
}

/** Initial bearing (degrees 0-360, 0 = north) from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  const la = (a.latitude * Math.PI) / 180;
  const lb = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Index of the polyline vertex closest to `point`. Linear scan — route
 * polylines are a few hundred points, negligible per GPS tick. */
export function nearestPointIndex(coords: LatLng[], point: LatLng): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i += 1) {
    const d = haversine(coords[i], point);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return '--';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatDuration(s: number | null | undefined): string {
  if (s == null) return '--';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function formatArrivalTime(remainingSeconds: number): string {
  const t = new Date(Date.now() + remainingSeconds * 1000);
  const hh = t.getHours().toString().padStart(2, '0');
  const mm = t.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
