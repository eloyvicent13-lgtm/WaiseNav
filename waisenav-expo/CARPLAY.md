# CarPlay — integración WaiseNav

Aviso importante primero: **CarPlay no funciona en Expo Go.** `react-native-carplay`
es un módulo nativo (Objective-C/Swift) que Expo Go no incluye. Todo lo demás en
esta app (login, mapa, asistente de voz) sí corre en Expo Go; CarPlay es la
única pieza que exige salir del flujo managed puro.

## 1. Requisito previo de Apple: la entitlement de mapas para CarPlay

Para que una app dibuje su propio mapa en la pantalla del coche (plantilla
`CPMapTemplate` con navegación turn-by-turn), Apple exige la entitlement
`com.apple.developer.carplay-maps`, que **solo se concede bajo solicitud** a
través de https://developer.apple.com/contact/carplay/ — no es automática
como el resto de capabilities. Sin ella, la app puede seguir usando otras
plantillas CarPlay (listas de POIs, "Ahora tocando", etc.) pero no el mapa
de navegación completo. Pide el acceso cuanto antes: la aprobación de Apple
puede tardar semanas.

## 2. Salir de Expo Go: dev client + prebuild

CarPlay requiere código nativo iOS (un `CarSceneDelegate`, entradas en
`Info.plist`, un target/escenas de CarPlay en Xcode). Con Expo eso se logra
así:

```bash
npx expo install expo-dev-client
npx expo prebuild -p ios       # genera la carpeta ios/ nativa
npx pod-install ios
```

A partir de aquí compilas con Xcode o EAS Build (`eas build -p ios
--profile development`), ya no con Expo Go.

## 3. Librería y dependencias

```bash
npm install react-native-carplay
```

Como el proyecto usa `expo prebuild` (no Expo Go), puedes:
- o bien editar directamente `ios/` tras el prebuild,
- o encapsular la configuración nativa en un **config plugin** de Expo para
  que sobreviva a futuros `prebuild` limpios (recomendado).

## 4. `app.json` — bloque adicional para CarPlay

Añade esto a `ios.entitlements` (nuevo bloque, junto al `infoPlist` ya
existente en `app.json`):

```jsonc
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.carplay-maps": true
      },
      "infoPlist": {
        "UIApplicationSceneManifest": {
          "UIApplicationSupportsMultipleScenes": true,
          "UISceneConfigurations": {
            "CPTemplateApplicationSceneSessionRoleApplication": [
              {
                "UISceneClassName": "CPTemplateApplicationScene",
                "UISceneConfigurationName": "CarPlayConfiguration",
                "UISceneDelegateClassName": "$(PRODUCT_MODULE_NAME).CarSceneDelegate"
              }
            ]
          }
        }
      }
    }
  }
}
```

`com.apple.developer.carplay-maps: true` solo tiene efecto una vez Apple
haya concedido la entitlement a tu cuenta de desarrollador (paso 1); antes
de eso, Xcode la firmará pero CarPlay rechazará el mapa en runtime.

## 5. Puente lógico app ↔ CarPlay

El patrón recomendado: la pantalla CarPlay (`CPMapTemplate`) es una vista
más sobre el **mismo estado de navegación** que `NavigationScreen.tsx`, no
una app aparte. Concretamente:

- `src/services/voiceAssistant.ts` y las `actions[]` (`start_route`,
  `cancel_navigation`) que ya llegan del backend se consumen igual desde el
  bridge de CarPlay: cuando `applyActions()` procesa un `start_route`,
  también debe empujar la ruta a `CarPlay.bridge` (vía
  `react-native-carplay`'s `MapTemplate`), no solo a `react-native-maps`.
- El micrófono se puede activar desde un botón en el propio `CPMapTemplate`
  (`mapButtons`) reusando `startRecording()` / `stopRecordingAndSend()` —
  el pipeline de voz es idéntico, cambia solo el trigger de UI.

Esta capa de bridge (un `src/carplay/` con `CarPlayScene.ts`) se añade
**después** de tener el prebuild nativo funcionando; no tiene sentido
escribirla contra Expo Go donde no puede probarse.

## Resumen del camino

1. Fase 1 (ahora): app completa en Expo Go — mapa, auth, asistente de voz.
2. Fase 2: `expo prebuild` + `expo-dev-client`, compilar con Xcode/EAS.
3. Fase 3: solicitar `com.apple.developer.carplay-maps` a Apple.
4. Fase 4: `react-native-carplay` + bridge de acciones del asistente.
