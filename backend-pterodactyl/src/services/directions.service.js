/**
 * Routing via the public OSRM demo instances hosted by FOSSGIS
 * (routing.openstreetmap.de) — free, no API key, supports both a driving
 * and a walking profile. Swap this for Google/Mapbox Directions later if
 * you need traffic-aware ETAs; the return shape is what the rest of the
 * app depends on, not the provider.
 */
const PROFILE_HOSTS = {
  driving: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
};

const MODIFIER_ES = {
  left: 'a la izquierda',
  right: 'a la derecha',
  'slight left': 'ligeramente a la izquierda',
  'slight right': 'ligeramente a la derecha',
  'sharp left': 'bruscamente a la izquierda',
  'sharp right': 'bruscamente a la derecha',
  straight: 'recto',
  uturn: 'cambio de sentido',
};

/** Builds a Spanish instruction string from an OSRM step maneuver. */
function buildInstruction(step) {
  const { type, modifier, exit } = step.maneuver || {};
  const road = step.name ? ` por ${step.name}` : '';

  switch (type) {
    case 'depart':
      return `Comienza${road}`;
    case 'arrive':
      return 'Has llegado a tu destino';
    case 'roundabout':
    case 'rotary':
      return exit ? `En la rotonda, toma la salida ${exit}` : 'Entra en la rotonda';
    case 'exit roundabout':
    case 'exit rotary':
      return `Sal de la rotonda${road}`;
    case 'merge':
      return `Incorpórate${road}`;
    case 'on ramp':
      return `Toma el acceso${road}`;
    case 'off ramp':
      return `Toma la salida${road}`;
    case 'fork':
      return modifier ? `Mantente ${MODIFIER_ES[modifier] || modifier}${road}` : `Continúa${road}`;
    case 'end of road':
      return modifier ? `Al final de la calle, gira ${MODIFIER_ES[modifier] || modifier}` : `Gira al final de la calle`;
    case 'continue':
    case 'new name':
      if (modifier === 'uturn') return 'Haz un cambio de sentido';
      if (modifier && modifier !== 'straight') return `Gira ${MODIFIER_ES[modifier] || modifier}${road}`;
      return `Continúa${road}`;
    case 'turn':
      if (modifier === 'uturn') return 'Haz un cambio de sentido';
      if (modifier === 'straight') return `Sigue recto${road}`;
      return `Gira ${MODIFIER_ES[modifier] || modifier}${road}`;
    default:
      return `Continúa${road}`;
  }
}

async function getRoute({ originLat, originLng, destLat, destLng, profile = 'driving', waypoints = [] }) {
  const base = PROFILE_HOSTS[profile] || PROFILE_HOSTS.driving;
  const chain = [
    `${originLng},${originLat}`,
    ...waypoints.map((w) => `${w.lng},${w.lat}`),
    `${destLng},${destLat}`,
  ].join(';');
  const url = `${base}/${chain}?overview=full&geometries=geojson&steps=true`;

  const resp = await fetch(url);
  const data = await resp.json();

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw Object.assign(new Error(`OSRM error: ${data.code || 'unknown'}`), {
      status: 502,
      publicMessage: 'No se pudo calcular la ruta',
    });
  }

  const route = data.routes[0];
  // Multiple waypoints produce multiple legs — concatenate their steps so
  // the client sees one continuous instruction list.
  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => ({
      instruction: buildInstruction(step),
      distance_meters: step.distance,
      duration_seconds: step.duration,
      lat: step.maneuver?.location?.[1] ?? null,
      lng: step.maneuver?.location?.[0] ?? null,
      type: step.maneuver?.type || 'continue',
      modifier: step.maneuver?.modifier || null,
    }))
  );

  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    })),
    steps,
  };
}

module.exports = { getRoute };
