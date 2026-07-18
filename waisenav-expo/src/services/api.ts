import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/env';

export const TOKEN_KEY = 'waisenav_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type AuthResponse = {
  token: string;
  user: { id: string; email: string; name: string | null };
};

export async function registerRequest(email: string, password: string, name?: string) {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name });
  return data;
}

export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export type PlaceResult = {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  open_now: boolean | null;
};

export async function searchPlaces(query: string, lat: number, lng: number) {
  const { data } = await api.get<{ results: PlaceResult[] }>('/places/search', {
    params: { query, lat, lng },
  });
  return data.results;
}

export type RouteStep = {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
  lat: number | null;
  lng: number | null;
  type: string;
  modifier: string | null;
};

export type RoutePreview = {
  distance_meters: number;
  duration_seconds: number;
  geometry: { latitude: number; longitude: number }[];
  steps: RouteStep[];
};

export type TransportMode = 'driving' | 'cycling' | 'walking';

export async function previewRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  mode: TransportMode = 'driving',
  waypoints: { lat: number; lng: number }[] = []
) {
  const { data } = await api.post<RoutePreview>('/directions/preview', {
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: dest.lat,
    destLng: dest.lng,
    mode,
    waypoints,
  });
  return data;
}

export type AutocompletePrediction = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export async function autocompletePlaces(input: string, lat: number, lng: number) {
  const { data } = await api.get<{ predictions: AutocompletePrediction[] }>('/places/autocomplete', {
    params: { input, lat, lng },
  });
  return data.predictions;
}

export async function getPlaceDetails(placeId: string) {
  const { data } = await api.get<{ place: { place_id: string; name: string; address: string; lat: number; lng: number } }>(
    '/places/details',
    { params: { place_id: placeId } }
  );
  return data.place;
}

export type RecentRoute = {
  id: string;
  destName: string;
  destLat: number;
  destLng: number;
  mode: string | null;
  createdAt: string;
};

export async function saveRouteHistory(entry: {
  destName: string;
  destLat: number;
  destLng: number;
  originLat: number;
  originLng: number;
  mode: string;
  source: string;
}) {
  await api.post('/routes', entry);
}

export async function getRecentRoutes() {
  const { data } = await api.get<{ routes: RecentRoute[] }>('/routes');
  return data.routes;
}

export type Favorite = {
  id: string;
  label: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
};

export async function getFavorites() {
  const { data } = await api.get<{ favorites: Favorite[] }>('/favorites');
  return data.favorites;
}

export async function setFavorite(label: string, fav: { name: string; address?: string; lat: number; lng: number }) {
  const { data } = await api.put<{ favorite: Favorite }>(`/favorites/${label}`, fav);
  return data.favorite;
}

export type ReportType = 'radar_movil' | 'accidente' | 'obstaculo' | 'policia';

export type NearbyReport = { id: string; type: ReportType; lat: number; lng: number };

export async function createReport(type: ReportType, lat: number, lng: number) {
  await api.post('/reports', { type, lat, lng });
}

export async function getNearbyReports(lat: number, lng: number, radiusKm = 15) {
  const { data } = await api.get<{ reports: NearbyReport[] }>('/reports', {
    params: { lat, lng, radius_km: radiusKm },
  });
  return data.reports;
}

export type Radar = {
  id: string;
  kind: 'fixed' | 'reported';
  lat: number;
  lng: number;
  maxspeed_kmh: number | null;
  road: string | null;
};

export async function getNearbyRadars(lat: number, lng: number, radiusKm = 20) {
  const { data } = await api.get<{ radars: Radar[] }>('/radars', {
    params: { lat, lng, radius_km: radiusKm },
  });
  return data.radars;
}

export async function getSpeedLimit(lat: number, lng: number) {
  const { data } = await api.get<{ maxspeed_kmh: number | null }>('/directions/speed-limit', {
    params: { lat, lng },
  });
  return data.maxspeed_kmh;
}

export type ChatResult = {
  reply_text: string;
  actions: { type: string; payload: Record<string, unknown> }[];
  audio_base64: string | null;
};

export async function sendChatMessage(
  message: string,
  location: { lat: number; lng: number },
  history: unknown[] = [],
  mode: 'driving' | 'walking' = 'driving',
  speak = false
) {
  const { data } = await api.post<ChatResult>('/ai/chat', {
    message,
    lat: location.lat,
    lng: location.lng,
    history,
    mode,
    speak,
  });
  return data;
}
