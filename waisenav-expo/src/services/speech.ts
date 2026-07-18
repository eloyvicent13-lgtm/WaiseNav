import * as Speech from 'expo-speech';

/**
 * Local (on-device) Spanish TTS for real-time navigation prompts — instant
 * and free, unlike the OpenAI TTS round trip used for assistant replies.
 */
export function speakNav(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'es-ES', rate: 1.0 });
}
