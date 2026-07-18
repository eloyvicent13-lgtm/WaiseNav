import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { api, RouteStep } from './api';

export type StartRoutePayload = {
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  place_id?: string;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  geometry?: { latitude: number; longitude: number }[] | null;
  steps?: RouteStep[] | null;
};

export type AddStopPayload = {
  stop_name: string;
  stop_lat: number;
  stop_lng: number;
};

export type AssistantAction =
  | { type: 'start_route'; payload: StartRoutePayload }
  | { type: 'cancel_navigation'; payload: Record<string, never> }
  | { type: 'add_stop'; payload: AddStopPayload };

export type VoiceCommandResult = {
  transcript: string;
  reply_text: string;
  actions: AssistantAction[];
  audio_base64: string;
};

let recording: Audio.Recording | null = null;

export async function startRecording() {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission not granted');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );
  recording = rec;
}

export async function stopRecordingAndSend(
  location: { lat: number; lng: number },
  history: unknown[] = [],
  mode: 'driving' | 'walking' = 'driving'
): Promise<VoiceCommandResult> {
  if (!recording) throw new Error('No active recording');

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  if (!uri) throw new Error('Recording produced no file');

  const form = new FormData();
  form.append('audio', {
    uri,
    name: 'command.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('lat', String(location.lat));
  form.append('lng', String(location.lng));
  form.append('history', JSON.stringify(history));
  form.append('mode', mode);

  const { data } = await api.post<VoiceCommandResult>('/ai/voice-command', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

/** Decodes the base64 mp3 reply and plays it through the device speaker. */
export async function playAssistantReply(audioBase64: string) {
  const fileUri = `${FileSystem.cacheDirectory}waisenav-reply-${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
    }
  });
}
