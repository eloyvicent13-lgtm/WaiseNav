const env = require('../config/env');

/**
 * Google Places Nearby Search wrapper. Swap the body of this function for
 * an Overpass/OSM query if you want a free, key-less alternative — the
 * return shape is what the rest of the app depends on, not the provider.
 */
async function searchNearbyPlaces({ query, lat, lng, radiusMeters = 5000 }) {
  if (!env.googlePlacesApiKey) {
    throw Object.assign(new Error('GOOGLE_PLACES_API_KEY not configured'), {
      status: 500,
      publicMessage: 'Places search is not configured on the server',
    });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('key', env.googlePlacesApiKey);

  const resp = await fetch(url.toString());
  const data = await resp.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw Object.assign(new Error(`Places API error: ${data.status}`), {
      status: 502,
      publicMessage: 'Could not reach places search provider',
    });
  }

  return (data.results || []).slice(0, 8).map((place) => ({
    place_id: place.place_id,
    name: place.name,
    address: place.formatted_address,
    lat: place.geometry?.location?.lat,
    lng: place.geometry?.location?.lng,
    rating: place.rating ?? null,
    open_now: place.opening_hours?.open_now ?? null,
  }));
}

/** Google Places Autocomplete — suggestions while the user types. */
async function autocompletePlaces({ input, lat, lng }) {
  if (!env.googlePlacesApiKey) {
    throw Object.assign(new Error('GOOGLE_PLACES_API_KEY not configured'), {
      status: 500,
      publicMessage: 'Places search is not configured on the server',
    });
  }
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', input);
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', '30000');
  url.searchParams.set('language', 'es');
  url.searchParams.set('key', env.googlePlacesApiKey);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw Object.assign(new Error(`Autocomplete error: ${data.status}`), {
      status: 502,
      publicMessage: 'Could not reach places provider',
    });
  }
  return (data.predictions || []).slice(0, 6).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text || p.description,
    secondary_text: p.structured_formatting?.secondary_text || '',
  }));
}

/** Google Place Details — resolve an autocomplete pick to coordinates. */
async function placeDetails(placeId) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'name,geometry,formatted_address');
  url.searchParams.set('language', 'es');
  url.searchParams.set('key', env.googlePlacesApiKey);

  const resp = await fetch(url.toString());
  const data = await resp.json();
  if (data.status !== 'OK') {
    throw Object.assign(new Error(`Place details error: ${data.status}`), {
      status: 502,
      publicMessage: 'Could not resolve that place',
    });
  }
  const r = data.result;
  return {
    place_id: placeId,
    name: r.name,
    address: r.formatted_address,
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
  };
}

module.exports = { searchNearbyPlaces, autocompletePlaces, placeDetails };
