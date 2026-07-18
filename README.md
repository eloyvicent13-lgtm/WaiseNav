# WaiseNav

Navegador GPS con asistente de voz IA. Monorepo con dos carpetas
independientes, cada una con su propio `package.json` y ciclo de vida:

```
WaiseNav/
├── backend-pterodactyl/   # API Node.js + landing, va en tu panel Pterodactyl
└── waisenav-expo/         # App iPhone, React Native + Expo
```

## Arquitectura general

```
[iPhone: WaiseNav app]
   │  audio (mic) ──────────────► POST /api/ai/voice-command
   │                                   │
   │                                   ▼
   │                          ┌─────────────────┐
   │                          │ Node.js backend │
   │                          │ (Pterodactyl)   │
   │                          │                 │
   │                          │ 1. Whisper      │──► OpenAI
   │                          │    transcribe   │
   │                          │ 2. GPT function │──► OpenAI (+ Google Places
   │                          │    calling loop │       para search_nearby_places)
   │                          │ 3. TTS synth    │──► OpenAI
   │                          └────────┬────────┘
   │                                   │ { transcript, reply_text,
   │                                   │   actions[], audio_base64 }
   │  ◄────────────────────────────────┘
   │  reproduce audio + ejecuta actions[] sobre el mapa
   ▼
[MapView (react-native-maps) + Speedometer + CarPlay bridge]
```

Punto clave de la arquitectura: **el backend nunca toca el mapa**. Solo
resuelve datos (búsqueda de lugares) y decide qué acción corresponde
(`start_route`, `cancel_navigation`); quien dibuja la ruta es siempre el
cliente (teléfono o CarPlay), que es donde vive el estado del mapa. Así el
mismo pipeline de voz sirve tanto para la pantalla del móvil como para la
de CarPlay sin duplicar lógica de IA.

## 1. Backend — `backend-pterodactyl/`

- Node.js + Express, Prisma (SQLite por defecto, swap a MySQL/Postgres
  cambiando `DATABASE_URL` si tu Pterodactyl tiene un servicio de DB).
- Auth: JWT + bcrypt (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`).
- IA: `/api/ai/voice-command` (pipeline completo Whisper→GPT→TTS) y
  `/api/ai/chat` (variante texto para depurar sin micrófono).
- Landing page estática servida en `/` desde `public/index.html`, mismo
  proceso que la API — cumple con "todo en mi propio servidor".
- Escucha en `0.0.0.0:8164`; en Pterodactyl asigna esa allocation a
  `149.202.84.78:8164`, que es el host que ya trae configurado
  `waisenav-expo/app.json` (`extra.apiHost` / `extra.apiPort`).

Arrancar en local:

```bash
cd backend-pterodactyl
cp .env.example .env      # rellena OPENAI_API_KEY, JWT_SECRET, etc.
npm install
npx prisma migrate dev --name init
npm run dev
```

Desplegar en Pterodactyl: sube esta carpeta (o apunta el egg Node.js a este
repo), configura las variables del `.env` como Environment Variables del
servidor, arranca con `npm run prisma:migrate && npm start`.

## 2. App — `waisenav-expo/`

- Expo (managed) + React Native, TypeScript.
- `react-native-maps` con provider por defecto (Apple MapKit en iOS): es el
  SDK de mapas que **sí corre en Expo Go** sin build nativa, y al ser
  MapKit comparte motor de renderizado con las plantillas de mapa de
  CarPlay — mejor punto de partida que Mapbox si el requisito es "probarlo
  ya en Expo Go". Si más adelante necesitas tráfico en tiempo real /
  isócronas / navegación turn-by-turn más rica, el salto natural es
  `@rnmapbox/maps`, pero eso ya exige dev client (ver más abajo).
- Auth contra el backend (`SecureStore` para el JWT).
- Asistente de voz: `expo-av` para grabar y reproducir, `src/services/voiceAssistant.ts`
  sube el audio a `/api/ai/voice-command` y aplica las `actions[]` devueltas
  sobre el `MapView`.
- CarPlay: ver `waisenav-expo/CARPLAY.md` — requiere salir de Expo Go
  (prebuild + dev client) y solicitar a Apple la entitlement
  `com.apple.developer.carplay-maps`. No es opcional saltarse ese permiso:
  sin él, Apple no deja renderizar mapa propio en la pantalla del coche.

Arrancar en local con Expo Go:

```bash
cd waisenav-expo
npm install
npx expo start
```

Escanea el QR con la app Expo Go en tu iPhone. El backend debe estar
accesible en `149.202.84.78:8164` desde el móvil (o cambia `extra.apiHost`
en `app.json` a tu IP local mientras desarrollas).

## 3. IA — resumen de decisiones

- **Whisper (`whisper-1`)**: transcribe el audio subido por la app
  (`src/services/openai.service.js#transcribeAudio`). Se ejecuta en backend
  para no exponer la API key en el binario de la app.
- **GPT con Function Calling (`gpt-4o-mini`)**: bucle en
  `runAssistantTurn()` que decide entre dos tipos de herramientas:
  - *resolver* (`search_nearby_places`): el backend la ejecuta y devuelve
    el resultado al modelo para que siga razonando.
  - *acción* (`start_route`, `cancel_navigation`): el backend NO la
    ejecuta, la reenvía tal cual en `actions[]` para que el cliente actúe
    sobre el mapa.
- **TTS (`tts-1`)**: sintetiza la respuesta final una sola vez por turno y
  se devuelve como `audio_base64` en la misma respuesta HTTP, para minimizar
  round trips desde el coche.

Los esquemas de las tres funciones están en
`backend-pterodactyl/src/services/functions.schema.js`, con comentarios
explicando cuándo el modelo debe encadenarlas (busca lugar → confirma →
inicia ruta).

## Próximos pasos sugeridos

1. `npm install` en ambas carpetas y probar el flujo completo end-to-end en
   Expo Go contra el backend en local (`.env` con `DATABASE_URL` sqlite).
2. Sustituir `GOOGLE_PLACES_API_KEY` por tu proveedor real, o cambiar
   `places.service.js` a Overpass/OSM si prefieres no depender de Google.
3. Endpoint de radares real (`GET /api/radars`) — hoy `RADAR_ALERTS` en
   `NavigationScreen.tsx` está vacío a propósito, pendiente de fuente de
   datos.
4. Seguir `CARPLAY.md` cuando quieras pasar de Expo Go a build nativa.
