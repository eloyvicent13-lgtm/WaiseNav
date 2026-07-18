import React from 'react';
import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  status: 'idle' | 'recording' | 'thinking' | 'speaking';
  onPressIn: () => void;
  onPressOut: () => void;
};

const ICON: Record<Exclude<Props['status'], 'thinking'>, keyof typeof Ionicons.glyphMap> = {
  idle: 'mic',
  recording: 'radio-button-on',
  speaking: 'volume-high',
};

export default function VoiceAssistantButton({ status, onPressIn, onPressOut }: Props) {
  return (
    <Pressable
      style={[styles.button, status === 'recording' && styles.recording]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {status === 'thinking' ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Ionicons name={ICON[status]} size={32} color="#fff" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#0a84ff',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  recording: { backgroundColor: '#ff453a', shadowColor: '#ff453a' },
});
