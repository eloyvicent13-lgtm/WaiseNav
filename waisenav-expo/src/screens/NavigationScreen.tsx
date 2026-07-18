import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Pressable, Text, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import Glass from '../components/Glass';
import Speedometer from '../components/Speedometer';
import VoiceAssistantButton from '../components/VoiceAssistantButton';
import MovementBadge from '../components/MovementBadge';
import RoutePreviewSheet from '../components/RoutePreviewSheet';
import NavigationHUD from '../components/NavigationHUD';
import ChatAssistantModal from '../components/ChatAssistantModal';
import SearchModal from '../components/SearchModal';
import ReportSheet from '../components/ReportSheet';
import { useMovementMode } from '../hooks/useMovementMode';
import {
  PlaceResult,
  RoutePreview,
  RouteStep,
  TransportMode,
  Radar,
  NearbyReport,
  previewRoute,
  saveRouteHistory,
  getNearbyRadars,
  getNearbyReports,
  getSpeedLimit,
} from '../services/api';
import { speakNav } from '../services/speech';
import { cumulativeDistances, nearestPointIndex, bearing, haversine, formatDistance, LatLng } from '../utils/geo';
import {
  startRecording,
  stopRecordingAndSend,
  playAssistantReply,
  AssistantAction,
  StartRoutePayload,
} from '../services/voiceAssistant';

type AssistantStatus = 'idle' | 'recording' | 'thinking' | 'speaking';
type NavPhase = 'idle' | 'preview' | 'navigating';

type ActiveRoute = {
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  address?: string | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  geometry: LatLng[];
  steps: RouteStep[];
  waypoints: { lat: number; lng: number }[];
};

type Progress = {
  remainingMeters: number;
  remainingSeconds: number;
  stepIdx: number;
  distToManeuver: number | null;
};

const ARRIVAL_THRESHOLD_M = 30;
const DEVIATION_THRESHOLD_M = 50;
const DEVIATION_TICKS = 3;
const RADAR_ALERT_DISTANCE_M = 400;

const REPORT_MARKER: Record<string, { icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
  radar_movil: { icon: 'radar', color: '#ff9f0a' },
  accidente: { icon: 'car-emergency', color: '#ff453a' },
  obstaculo: { icon: 'alert-octagon', color: '#facc15' },
  policia: { icon: 'police-badge', color: '#0a84ff' },
};

export default function NavigationScreen() {
  const mapRef = useRef<MapView>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('idle');
  const [navPhase, setNavPhase] = useState<NavPhase>('idle');
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [recalculating, setRecalculating] = useState(false);
  const [radars, setRadars] = useState<Radar[]>([]);
  const [reports, setReports] = useState<NearbyReport[]>([]);
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<'light' | 'dark'>('light');
  const conversationHistory = useRef<unknown[]>([]);
  const { mode, sample } = useMovementMode();

  // Refs mirrored from state so the long-lived GPS callback never reads
  // stale values.
  const navPhaseRef = useRef<NavPhase>('idle');
  const routeRef = useRef<ActiveRoute | null>(null);
  const cumDistRef = useRef<number[]>([]);
  const stepStartCumRef = useRef<number[]>([]);
  const transportRef = useRef<TransportMode>('driving');
  const radarsRef = useRef<Radar[]>([]);
  const reportsRef = useRef<NearbyReport[]>([]);
  const alertedRadarsRef = useRef<Set<string>>(new Set());
  const announcedStepRef = useRef<{ idx: number; near: boolean; now: boolean }>({ idx: -1, near: false, now: false });
  const deviationTicksRef = useRef(0);
  const reroutingRef = useRef(false);
  const limitFetchRef = useRef<{ at: number; pos: LatLng | null }>({ at: 0, pos: null });
  const overspeedWarnedAtRef = useRef(0);

  useEffect(() => {
    transportRef.current = transportMode;
  }, [transportMode]);

  // Day/night map style by local hour, re-checked every 10 min.
  useEffect(() => {
    const update = () => {
      const h = new Date().getHours();
      setMapStyle(h >= 20 || h < 7 ? 'dark' : 'light');
    };
    update();
    const t = setInterval(update, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Radars + community reports refresh around the user every 60s.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const fetchAll = async () => {
      const loc = userLocation;
      if (!loc) return;
      try {
        const [r, rep] = await Promise.all([
          getNearbyRadars(loc.latitude, loc.longitude),
          getNearbyReports(loc.latitude, loc.longitude),
        ]);
        setRadars(r);
        radarsRef.current = r;
        setReports(rep);
        reportsRef.current = rep;
      } catch {
        // network hiccup — keep previous data
      }
    };
    if (userLocation) {
      fetchAll();
      timer = setInterval(fetchAll, 60 * 1000);
    }
    return () => timer && clearInterval(timer);
  }, [userLocation == null]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    (async () => {
      setLocationError(null);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Necesitamos permiso de ubicación para mostrar el mapa. Actívalo en Ajustes > WaiseNav > Ubicación.');
          return;
        }

        // getCurrentPositionAsync has no built-in timeout and can hang
        // indefinitely indoors / with a cold GPS fix — race it against a
        // manual timeout so the app never gets stuck on a blank screen.
        const initial = await Promise.race([
          Location.getCurrentPositionAsync({}),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 15000)
          ),
        ]);
        if (cancelled) return;

        const start = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        setUserLocation(start);
        setInitialRegion({ ...start, latitudeDelta: 0.01, longitudeDelta: 0.01 });

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
          (loc) => {
            const speedMs = loc.coords.speed ?? 0;
            setSpeedKmh(Math.max(0, speedMs * 3.6));
            sample(speedMs);

            const here = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(here);

            if (navPhaseRef.current === 'navigating' && routeRef.current) {
              updateNavigationProgress(here, loc.coords.heading ?? -1, speedMs);
              checkRadarProximity(here);
              maybeFetchSpeedLimit(here, speedMs);
            }
          }
        );
      } catch {
        if (!cancelled) {
          setLocationError('No se pudo obtener tu ubicación. Comprueba que el GPS está activado.');
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [retryTick]);

  /** Bearing of the route itself at vertex `idx`, looking ~40m ahead. */
  function routeBearingAt(geometry: LatLng[], idx: number): number {
    const cum = cumDistRef.current;
    const target = cum[idx] + 40;
    let j = idx + 1;
    while (j < geometry.length - 1 && cum[j] < target) j += 1;
    if (j <= idx) return 0;
    return bearing(geometry[idx], geometry[j]);
  }

  function announceManeuvers(stepIdx: number, distToManeuver: number | null, steps: RouteStep[]) {
    if (distToManeuver == null || !steps[stepIdx]) return;
    const s = announcedStepRef.current;
    const instruction = steps[stepIdx].instruction;

    if (s.idx !== stepIdx) {
      announcedStepRef.current = { idx: stepIdx, near: false, now: false };
      if (distToManeuver > 180) {
        speakNav(`En ${formatDistance(distToManeuver)}, ${instruction}`);
        return;
      }
    }
    const state = announcedStepRef.current;
    if (!state.near && distToManeuver <= 180 && distToManeuver > 45) {
      state.near = true;
      speakNav(`En ${Math.round(distToManeuver / 10) * 10} metros, ${instruction}`);
    } else if (!state.now && distToManeuver <= 45) {
      state.now = true;
      state.near = true;
      speakNav(instruction);
    }
  }

  function checkRadarProximity(here: LatLng) {
    const hazards: { id: string; lat: number; lng: number; label: string }[] = [
      ...radarsRef.current.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, label: 'Radar' })),
      ...reportsRef.current
        .filter((r) => r.type !== 'radar_movil')
        .map((r) => ({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          label: r.type === 'accidente' ? 'Accidente' : r.type === 'policia' ? 'Control policial' : 'Obstáculo',
        })),
    ];
    for (const h of hazards) {
      if (alertedRadarsRef.current.has(h.id)) continue;
      const d = haversine(here, { latitude: h.lat, longitude: h.lng });
      if (d < RADAR_ALERT_DISTANCE_M) {
        alertedRadarsRef.current.add(h.id);
        speakNav(`${h.label} a ${Math.round(d / 50) * 50} metros`);
      }
    }
  }

  async function maybeFetchSpeedLimit(here: LatLng, speedMs: number) {
    const ref = limitFetchRef.current;
    const now = Date.now();
    const movedEnough = !ref.pos || haversine(here, ref.pos) > 300;
    if (now - ref.at < 20000 && !movedEnough) return;
    limitFetchRef.current = { at: now, pos: here };
    try {
      const limit = await getSpeedLimit(here.latitude, here.longitude);
      setSpeedLimit(limit);
      const kmh = speedMs * 3.6;
      if (limit != null && kmh > limit + 5 && now - overspeedWarnedAtRef.current > 60000) {
        overspeedWarnedAtRef.current = now;
        speakNav(`Atención, estás superando el límite de ${limit}`);
      }
    } catch {
      // Overpass rate-limited — keep last known limit
    }
  }

  async function maybeReroute(here: LatLng) {
    const route = routeRef.current;
    if (!route || reroutingRef.current || route.geometry.length < 2) return;
    reroutingRef.current = true;
    try {
      speakNav('Recalculando ruta');
      const updated = await previewRoute(
        { lat: here.latitude, lng: here.longitude },
        { lat: route.destination_lat, lng: route.destination_lng },
        transportRef.current,
        route.waypoints
      );
      const refreshed: ActiveRoute = {
        ...route,
        distance_meters: updated.distance_meters,
        duration_seconds: updated.duration_seconds,
        geometry: updated.geometry,
        steps: updated.steps,
      };
      prepareRefs(refreshed);
      setActiveRoute(refreshed);
      announcedStepRef.current = { idx: -1, near: false, now: false };
    } catch {
      // keep the old route; next deviation tick may retry
    } finally {
      deviationTicksRef.current = 0;
      reroutingRef.current = false;
    }
  }

  function updateNavigationProgress(here: LatLng, gpsHeading: number, speedMs: number) {
    const route = routeRef.current;
    if (!route || route.geometry.length < 2) return;

    const cum = cumDistRef.current;
    const total = cum[cum.length - 1];
    const idx = nearestPointIndex(route.geometry, here);
    const offRoute = haversine(here, route.geometry[idx]);

    if (offRoute > DEVIATION_THRESHOLD_M) {
      deviationTicksRef.current += 1;
      if (deviationTicksRef.current >= DEVIATION_TICKS) {
        maybeReroute(here);
      }
    } else {
      deviationTicksRef.current = 0;
    }

    const traveled = cum[idx];
    const remainingMeters = Math.max(0, total - traveled);
    const totalDur = route.duration_seconds ?? 0;
    const remainingSeconds = total > 0 ? totalDur * (remainingMeters / total) : 0;

    if (remainingMeters < ARRIVAL_THRESHOLD_M) {
      speakNav(`Has llegado a ${route.destination_name}`);
      exitNavigation();
      Alert.alert('WaiseNav', `Has llegado a ${route.destination_name}`);
      return;
    }

    const stepCum = stepStartCumRef.current;
    let stepIdx = stepCum.findIndex((c) => c > traveled + 5);
    if (stepIdx === -1) stepIdx = route.steps.length - 1;
    const distToManeuver = stepCum.length ? Math.max(0, stepCum[stepIdx] - traveled) : null;

    setProgress({ remainingMeters, remainingSeconds, stepIdx, distToManeuver });
    announceManeuvers(stepIdx, distToManeuver, route.steps);

    const heading =
      gpsHeading >= 0 && speedMs > 1 ? gpsHeading : routeBearingAt(route.geometry, idx);
    const altitude = Math.min(900, 300 + speedMs * 3.6 * 8);

    mapRef.current?.animateCamera(
      { center: here, heading, pitch: 60, altitude, zoom: 17.5 },
      { duration: 800 }
    );
  }

  function toActiveRoute(payload: StartRoutePayload, address?: string | null): ActiveRoute {
    return {
      destination_name: payload.destination_name,
      destination_lat: payload.destination_lat,
      destination_lng: payload.destination_lng,
      address: address ?? null,
      distance_meters: payload.distance_meters ?? null,
      duration_seconds: payload.duration_seconds ?? null,
      geometry: payload.geometry ?? [],
      steps: payload.steps ?? [],
      waypoints: [],
    };
  }

  function prepareRefs(route: ActiveRoute) {
    routeRef.current = route;
    cumDistRef.current = route.geometry.length ? cumulativeDistances(route.geometry) : [];
    const starts: number[] = [];
    let acc = 0;
    for (const step of route.steps) {
      starts.push(acc);
      acc += step.distance_meters;
    }
    stepStartCumRef.current = starts;
  }

  function showPreview(route: ActiveRoute) {
    prepareRefs(route);
    setActiveRoute(route);
    setNavPhase('preview');
    navPhaseRef.current = 'preview';
    if (route.geometry.length > 1) {
      mapRef.current?.fitToCoordinates(route.geometry, {
        edgePadding: { top: 120, bottom: 300, left: 60, right: 60 },
        animated: true,
      });
    }
  }

  function startNavigation(route: ActiveRoute, source = 'search') {
    prepareRefs(route);
    setActiveRoute(route);
    setNavPhase('navigating');
    navPhaseRef.current = 'navigating';
    announcedStepRef.current = { idx: -1, near: false, now: false };
    alertedRadarsRef.current = new Set();
    deviationTicksRef.current = 0;
    setProgress({
      remainingMeters: route.distance_meters ?? 0,
      remainingSeconds: route.duration_seconds ?? 0,
      stepIdx: 0,
      distToManeuver: route.steps.length > 1 ? route.steps[0].distance_meters : null,
    });

    if (userLocation) {
      saveRouteHistory({
        destName: route.destination_name,
        destLat: route.destination_lat,
        destLng: route.destination_lng,
        originLat: userLocation.latitude,
        originLng: userLocation.longitude,
        mode: transportRef.current,
        source,
      }).catch(() => {});

      const idx = route.geometry.length > 1 ? nearestPointIndex(route.geometry, userLocation) : 0;
      const heading = route.geometry.length > 1 ? routeBearingAt(route.geometry, idx) : 0;
      mapRef.current?.animateCamera(
        { center: userLocation, heading, pitch: 60, altitude: 350, zoom: 17.5 },
        { duration: 1000 }
      );
    }
  }

  function exitNavigation() {
    setNavPhase('idle');
    navPhaseRef.current = 'idle';
    setActiveRoute(null);
    setProgress(null);
    setSpeedLimit(null);
    routeRef.current = null;
    mapRef.current?.animateCamera({ pitch: 0, heading: 0, zoom: 15 }, { duration: 700 });
  }

  async function addStopToRoute(stop: { lat: number; lng: number; name: string }) {
    const route = routeRef.current;
    if (!route || !userLocation) {
      Alert.alert('WaiseNav', 'No hay ruta activa a la que añadir parada.');
      return;
    }
    try {
      const waypoints = [...route.waypoints, { lat: stop.lat, lng: stop.lng }];
      const updated = await previewRoute(
        { lat: userLocation.latitude, lng: userLocation.longitude },
        { lat: route.destination_lat, lng: route.destination_lng },
        transportRef.current,
        waypoints
      );
      const refreshed: ActiveRoute = {
        ...route,
        distance_meters: updated.distance_meters,
        duration_seconds: updated.duration_seconds,
        geometry: updated.geometry,
        steps: updated.steps,
        waypoints,
      };
      prepareRefs(refreshed);
      setActiveRoute(refreshed);
      announcedStepRef.current = { idx: -1, near: false, now: false };
      speakNav(`Parada añadida: ${stop.name}`);
    } catch {
      Alert.alert('Error', 'No se pudo añadir la parada.');
    }
  }

  function applyActions(actions: AssistantAction[]) {
    for (const action of actions) {
      if (action.type === 'start_route') {
        setTransportMode(mode === 'driving' ? 'driving' : 'walking');
        startNavigation(toActiveRoute(action.payload), 'voice_command');
      } else if (action.type === 'cancel_navigation') {
        exitNavigation();
      } else if (action.type === 'add_stop') {
        addStopToRoute({
          name: action.payload.stop_name,
          lat: action.payload.stop_lat,
          lng: action.payload.stop_lng,
        });
      }
    }
  }

  function handleRouteFromSearch(place: PlaceResult, route: RoutePreview) {
    const asNewRoute = () => {
      setTransportMode(mode === 'driving' ? 'driving' : 'walking');
      showPreview(
        toActiveRoute(
          {
            destination_name: place.name,
            destination_lat: place.lat,
            destination_lng: place.lng,
            place_id: place.place_id,
            distance_meters: route.distance_meters,
            duration_seconds: route.duration_seconds,
            geometry: route.geometry,
            steps: route.steps,
          },
          place.address
        )
      );
    };

    if (navPhaseRef.current === 'navigating') {
      Alert.alert(place.name, '¿Qué quieres hacer?', [
        { text: 'Nueva ruta', onPress: asNewRoute },
        { text: 'Añadir parada', onPress: () => addStopToRoute({ name: place.name, lat: place.lat, lng: place.lng }) },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } else {
      asNewRoute();
    }
  }

  async function handleTransportChange(newMode: TransportMode) {
    const route = routeRef.current;
    if (!route || !userLocation) return;
    setTransportMode(newMode);
    setRecalculating(true);
    try {
      const updated = await previewRoute(
        { lat: userLocation.latitude, lng: userLocation.longitude },
        { lat: route.destination_lat, lng: route.destination_lng },
        newMode,
        route.waypoints
      );
      const refreshed: ActiveRoute = {
        ...route,
        distance_meters: updated.distance_meters,
        duration_seconds: updated.duration_seconds,
        geometry: updated.geometry,
        steps: updated.steps,
      };
      prepareRefs(refreshed);
      setActiveRoute(refreshed);
      if (refreshed.geometry.length > 1) {
        mapRef.current?.fitToCoordinates(refreshed.geometry, {
          edgePadding: { top: 120, bottom: 300, left: 60, right: 60 },
          animated: true,
        });
      }
    } catch {
      Alert.alert('Error', 'No se pudo recalcular la ruta para ese modo.');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleMicPressIn() {
    try {
      setAssistantStatus('recording');
      await startRecording();
    } catch {
      setAssistantStatus('idle');
      Alert.alert('Error', 'No se pudo acceder al micrófono.');
    }
  }

  async function handleMicPressOut() {
    if (!userLocation) return;
    try {
      setAssistantStatus('thinking');
      const result = await stopRecordingAndSend(
        { lat: userLocation.latitude, lng: userLocation.longitude },
        conversationHistory.current,
        mode === 'driving' ? 'driving' : 'walking'
      );

      conversationHistory.current.push(
        { role: 'user', content: result.transcript },
        { role: 'assistant', content: result.reply_text }
      );

      applyActions(result.actions);

      setAssistantStatus('speaking');
      await playAssistantReply(result.audio_base64);
      setAssistantStatus('idle');
    } catch {
      setAssistantStatus('idle');
      Alert.alert('Error', 'No se pudo procesar el comando de voz.');
    }
  }

  function refreshReports() {
    const loc = userLocation;
    if (!loc) return;
    getNearbyReports(loc.latitude, loc.longitude)
      .then((rep) => {
        setReports(rep);
        reportsRef.current = rep;
      })
      .catch(() => {});
  }

  if (!initialRegion || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        {locationError ? (
          <>
            <Ionicons name="location-outline" size={40} color="#ff453a" style={{ marginBottom: 12 }} />
            <Text style={styles.loadingText}>{locationError}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setLocationError(null);
                setRetryTick((t) => t + 1);
              }}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color="#0a84ff" size="large" style={{ marginBottom: 16 }} />
            <Text style={styles.loadingText}>Buscando tu ubicación...</Text>
          </>
        )}
      </View>
    );
  }

  const isNavigating = navPhase === 'navigating';
  const currentStep = isNavigating && activeRoute && progress ? activeRoute.steps[progress.stepIdx] ?? null : null;
  const nextStep =
    isNavigating && activeRoute && progress ? activeRoute.steps[progress.stepIdx + 1] ?? null : null;

  const routeCoords =
    activeRoute?.geometry?.length
      ? activeRoute.geometry
      : activeRoute
      ? [userLocation, { latitude: activeRoute.destination_lat, longitude: activeRoute.destination_lng }]
      : [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        followsUserLocation={!isNavigating && navPhase !== 'preview'}
        userInterfaceStyle={mapStyle}
      >
        {radars.map((radar) => (
          <Marker key={radar.id} coordinate={{ latitude: radar.lat, longitude: radar.lng }} title={radar.kind === 'fixed' ? `Radar fijo${radar.maxspeed_kmh ? ` ${radar.maxspeed_kmh} km/h` : ''}` : 'Radar móvil (reportado)'}>
            <View style={[styles.hazardMarker, { borderColor: '#ff9f0a' }]}>
              <MaterialCommunityIcons name="radar" size={16} color="#ff9f0a" />
            </View>
          </Marker>
        ))}

        {reports
          .filter((r) => r.type !== 'radar_movil')
          .map((rep) => {
            const cfg = REPORT_MARKER[rep.type];
            return (
              <Marker key={rep.id} coordinate={{ latitude: rep.lat, longitude: rep.lng }} title={rep.type.replace('_', ' ')}>
                <View style={[styles.hazardMarker, { borderColor: cfg.color }]}>
                  <MaterialCommunityIcons name={cfg.icon} size={16} color={cfg.color} />
                </View>
              </Marker>
            );
          })}

        {activeRoute && (
          <>
            <Marker
              coordinate={{
                latitude: activeRoute.destination_lat,
                longitude: activeRoute.destination_lng,
              }}
              title={activeRoute.destination_name}
            />
            {activeRoute.waypoints.map((w, i) => (
              <Marker key={`wp-${i}`} coordinate={{ latitude: w.lat, longitude: w.lng }} pinColor="green" title="Parada" />
            ))}
            <Polyline coordinates={routeCoords} strokeColor="rgba(10,132,255,0.35)" strokeWidth={10} />
            <Polyline coordinates={routeCoords} strokeColor="#0a84ff" strokeWidth={5} />
          </>
        )}
      </MapView>

      {!isNavigating && (
        <View style={styles.topRight}>
          <Speedometer speedKmh={speedKmh} limitKmh={speedLimit} />
          <View style={{ height: 8 }} />
          <MovementBadge mode={mode} />
        </View>
      )}

      {isNavigating && progress && (
        <NavigationHUD
          step={currentStep}
          distanceToManeuver={progress.distToManeuver}
          nextStep={nextStep}
          remainingSeconds={progress.remainingSeconds}
          remainingMeters={progress.remainingMeters}
          onExit={exitNavigation}
        />
      )}

      {isNavigating && (
        <View style={styles.navLeftCluster}>
          <Glass style={styles.navSpeedPill} radius={999} intensity={55}>
            <Text style={[styles.navSpeedText, speedLimit != null && speedKmh > speedLimit + 3 && { color: '#ff453a' }]}>
              {Math.max(0, Math.round(speedKmh))} km/h
            </Text>
          </Glass>
          {speedLimit != null && (
            <View style={styles.limitSign}>
              <Text style={styles.limitText}>{speedLimit}</Text>
            </View>
          )}
        </View>
      )}

      {isNavigating && (
        <Pressable style={styles.reportButton} onPress={() => setReportVisible(true)}>
          <Glass style={styles.reportGlass} radius={26} intensity={55}>
            <Ionicons name="warning" size={22} color="#ff9f0a" />
          </Glass>
        </Pressable>
      )}

      {navPhase === 'preview' && activeRoute && (
        <RoutePreviewSheet
          destinationName={activeRoute.destination_name}
          address={activeRoute.address}
          distanceMeters={activeRoute.distance_meters}
          durationSeconds={activeRoute.duration_seconds}
          transportMode={transportMode}
          recalculating={recalculating}
          onTransportChange={handleTransportChange}
          onGo={() => startNavigation(activeRoute)}
          onClose={exitNavigation}
        />
      )}

      {navPhase === 'idle' && (
        <View style={styles.bottomLeft}>
          <Pressable onPress={() => setSearchVisible(true)}>
            <Glass style={styles.fab} radius={26} intensity={55}>
              <Ionicons name="search" size={22} color="#fff" />
            </Glass>
          </Pressable>
          <View style={{ height: 12 }} />
          <Pressable onPress={() => setChatVisible(true)}>
            <Glass style={styles.fab} radius={26} intensity={55}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
            </Glass>
          </Pressable>
        </View>
      )}

      {navPhase !== 'preview' && (
        <View style={isNavigating ? styles.voiceNavPosition : styles.voiceIdlePosition}>
          <VoiceAssistantButton
            status={assistantStatus}
            onPressIn={handleMicPressIn}
            onPressOut={handleMicPressOut}
          />
        </View>
      )}

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        location={{ lat: userLocation.latitude, lng: userLocation.longitude }}
        mode={mode}
        onRouteSelected={handleRouteFromSearch}
      />

      <ChatAssistantModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        location={{ lat: userLocation.latitude, lng: userLocation.longitude }}
        mode={mode}
        onActions={applyActions}
      />

      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        location={{ lat: userLocation.latitude, lng: userLocation.longitude }}
        onReported={() => {
          refreshReports();
          speakNav('Reporte enviado, gracias');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0b0f14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: { color: '#fff', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  topRight: { position: 'absolute', top: 56, right: 16, alignItems: 'flex-end' },
  bottomLeft: { position: 'absolute', bottom: 24, left: 16 },
  fab: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIdlePosition: { position: 'absolute', bottom: 24, right: 16 },
  voiceNavPosition: { position: 'absolute', bottom: 116, right: 16 },
  navLeftCluster: { position: 'absolute', bottom: 116, left: 16, alignItems: 'flex-start' },
  navSpeedPill: { paddingHorizontal: 14, paddingVertical: 8 },
  navSpeedText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  limitSign: {
    marginTop: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#d70015',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitText: { color: '#000', fontSize: 15, fontWeight: '900' },
  reportButton: { position: 'absolute', bottom: 196, right: 16 },
  reportGlass: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  hazardMarker: {
    backgroundColor: 'rgba(11,15,20,0.9)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
