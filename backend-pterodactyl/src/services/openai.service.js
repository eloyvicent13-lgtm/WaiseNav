const fs = require('fs');
const OpenAI = require('openai');
const { toFile } = require('openai');
const env = require('../config/env');
const { tools } = require('./functions.schema');
const { searchNearbyPlaces } = require('./places.service');
const { getRoute } = require('./directions.service');
const prisma = require('./prisma');

const client = new OpenAI({ apiKey: env.openai.apiKey });

const SYSTEM_PROMPT = `You are the voice assistant embedded in WaiseNav, a GPS navigation app.
The driver talks to you naturally while driving. Be concise (1-2 sentences,
this will be read aloud). Always resolve a destination to coordinates via
search_nearby_places before calling start_route unless the user already gave
exact coordinates. Never invent coordinates. If a request is ambiguous
(e.g. multiple gas stations found), briefly ask which one, don't guess.
When a route is started you will be given its distance and estimated time —
mention the ETA briefly in your spoken reply (e.g. "Vale, 12 minutos, 4.3 km").
"Llévame a casa" / "vamos al trabajo": use go_to_favorite first, then
start_route with its coordinates. To add an intermediate stop to an active
route ("añade una gasolinera en la ruta"): resolve it with
search_nearby_places, then call add_stop (NOT start_route).`;

/**
 * Transcribe raw audio with Whisper. multer saves uploads under a random
 * filename with no extension, so the SDK can't infer the format from
 * `filePath` alone even though the bytes are valid — `toFile` lets us
 * attach the real filename (with extension) the client sent, independent
 * of the on-disk name.
 */
async function transcribeAudio(filePath, originalName = 'command.m4a') {
  const transcription = await client.audio.transcriptions.create({
    file: await toFile(fs.createReadStream(filePath), originalName),
    model: env.openai.whisperModel,
    language: 'es',
  });
  return transcription.text;
}

/** Synthesize speech for a reply, returns a Buffer (mp3). */
async function synthesizeSpeech(text) {
  const response = await client.audio.speech.create({
    model: env.openai.ttsModel,
    voice: env.openai.ttsVoice,
    input: text,
    response_format: 'mp3',
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Executes a "resolver" tool call server-side. Returns the JSON string to
 * feed back to the model as the tool result.
 */
async function executeResolverTool(name, args, context) {
  if (name === 'search_nearby_places') {
    const places = await searchNearbyPlaces({
      query: args.query,
      lat: context.userLocation.lat,
      lng: context.userLocation.lng,
      radiusMeters: (args.radius_km || 5) * 1000,
    });
    return JSON.stringify({ results: places });
  }
  if (name === 'go_to_favorite') {
    const raw = String(args.label || '').toLowerCase();
    // Map common Spanish phrasings to canonical labels.
    const label = /cas|hogar|home/.test(raw) ? 'home' : /trabaj|curro|work|ofici/.test(raw) ? 'work' : raw;
    const favorite = await prisma.favorite.findUnique({
      where: { userId_label: { userId: context.userId, label } },
    });
    if (!favorite) {
      return JSON.stringify({ error: `No hay ningún favorito guardado como "${label}". Dile al usuario que lo guarde desde la búsqueda.` });
    }
    return JSON.stringify({
      name: favorite.name,
      address: favorite.address,
      lat: favorite.lat,
      lng: favorite.lng,
    });
  }
  throw new Error(`Unknown resolver tool: ${name}`);
}

/**
 * Runs the full function-calling loop for one user turn.
 * Returns { replyText, actions } where actions is what the client (the
 * phone's map) must execute.
 */
async function runAssistantTurn({ userText, userLocation, history = [], mode = 'driving', userId = null }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userText },
  ];

  const actions = [];
  const MAX_ITERATIONS = 4;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const completion = await client.chat.completions.create({
      model: env.openai.chatModel,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0];
    const message = choice.message;
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { replyText: message.content || '', actions };
    }

    for (const call of message.tool_calls) {
      const name = call.function.name;
      const args = JSON.parse(call.function.arguments || '{}');

      if (name === 'start_route') {
        // Resolve the actual route (distance/duration/geometry) server-side
        // so the model can mention the ETA out loud, and so the client gets
        // real road geometry instead of a straight line.
        let route = null;
        try {
          route = await getRoute({
            originLat: userLocation.lat,
            originLng: userLocation.lng,
            destLat: args.destination_lat,
            destLng: args.destination_lng,
            profile: mode,
          });
        } catch {
          // fall through with no route data; client still gets the action
        }

        actions.push({
          type: 'start_route',
          payload: {
            ...args,
            distance_meters: route?.distanceMeters ?? null,
            duration_seconds: route?.durationSeconds ?? null,
            geometry: route?.geometry ?? null,
            steps: route?.steps ?? null,
          },
        });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(
            route
              ? {
                  status: 'route_started',
                  distance_meters: Math.round(route.distanceMeters),
                  duration_seconds: Math.round(route.durationSeconds),
                }
              : { status: 'route_started_no_eta' }
          ),
        });
      } else if (name === 'cancel_navigation' || name === 'add_stop') {
        actions.push({ type: name, payload: args });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'queued_for_client' }),
        });
      } else {
        const result = await executeResolverTool(name, args, { userLocation, userId });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result,
        });
      }
    }
  }

  return {
    replyText: 'Lo siento, no he podido completar la petición.',
    actions,
  };
}

module.exports = { transcribeAudio, synthesizeSpeech, runAssistantTurn };
