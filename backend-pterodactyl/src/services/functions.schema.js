/**
 * OpenAI Function Calling tool definitions. Two kinds of tools live here:
 *
 *  - "resolver" tools (search_nearby_places, report_radar): the backend
 *    executes them itself (calls Places API / DB) and feeds the result
 *    back to the model.
 *
 *  - "action" tools (start_route, cancel_navigation): the backend does NOT
 *    execute them. It validates the arguments and passes them through as
 *    an `actions[]` entry in the API response — the phone app is the one
 *    that actually draws the route / stops navigation, because the map
 *    lives on the client, not the server.
 */

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_nearby_places',
      description:
        'Search for places near the driver current location (gas stations, parking, restaurants, EV chargers, etc). Use this before start_route whenever the user asks for "the nearest X" or "find a X".',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search text, e.g. "gasolinera", "parking", "restaurante italiano"',
          },
          category: {
            type: 'string',
            enum: ['gas_station', 'parking', 'restaurant', 'ev_charging', 'other'],
            description: 'Best-effort category classification of the query',
          },
          radius_km: {
            type: 'number',
            description: 'Search radius in kilometers, default 5',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_route',
      description:
        'Start turn-by-turn navigation on the map to a chosen destination. Call this only after you know the destination coordinates (e.g. from a prior search_nearby_places result, or a place the user named explicitly).',
      parameters: {
        type: 'object',
        properties: {
          destination_name: { type: 'string', description: 'Human readable destination label' },
          destination_lat: { type: 'number' },
          destination_lng: { type: 'number' },
          place_id: { type: 'string', description: 'Optional provider place id, if known' },
        },
        required: ['destination_name', 'destination_lat', 'destination_lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_navigation',
      description: 'Stop the currently active route/navigation on the map.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'go_to_favorite',
      description:
        'Look up one of the user saved favorite places (e.g. "casa"/home, "trabajo"/work) and get its coordinates. Use when the user says "llévame a casa", "vamos al trabajo", etc. Then call start_route with the returned coordinates.',
      parameters: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Favorite label. "home" for casa, "work" for trabajo, or the custom name the user said.',
          },
        },
        required: ['label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_stop',
      description:
        'Add an intermediate stop to the CURRENT active route without changing the final destination. Resolve the stop coordinates first (search_nearby_places) if the user asked for a category like "una gasolinera en la ruta".',
      parameters: {
        type: 'object',
        properties: {
          stop_name: { type: 'string' },
          stop_lat: { type: 'number' },
          stop_lng: { type: 'number' },
        },
        required: ['stop_name', 'stop_lat', 'stop_lng'],
      },
    },
  },
];

module.exports = { tools };
