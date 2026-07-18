import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Glass from './Glass';
import { MovementMode } from '../hooks/useMovementMode';

const CONFIG: Record<MovementMode, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  stationary: { icon: 'pause', label: 'Parado' },
  walking: { icon: 'walk', label: 'Andando' },
  driving: { icon: 'car', label: 'Coche' },
};

export default function MovementBadge({ mode }: { mode: MovementMode }) {
  const { icon, label } = CONFIG[mode];
  return (
    <Glass style={styles.container} radius={999} intensity={55}>
      <View style={styles.row}>
        <Ionicons name={icon} size={14} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.text}>{label}</Text>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 13, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
