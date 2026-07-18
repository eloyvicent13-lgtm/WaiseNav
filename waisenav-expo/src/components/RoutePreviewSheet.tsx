import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Glass from './Glass';
import { TransportMode } from '../services/api';
import { formatDistance, formatDuration, formatArrivalTime } from '../utils/geo';

const TRANSPORTS: { key: TransportMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'driving', icon: 'car' },
  { key: 'cycling', icon: 'bicycle' },
  { key: 'walking', icon: 'walk' },
];

type Props = {
  destinationName: string;
  address?: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  transportMode: TransportMode;
  recalculating?: boolean;
  onTransportChange: (mode: TransportMode) => void;
  onGo: () => void;
  onClose: () => void;
};

/**
 * Apple-Maps-style pre-navigation sheet: destination, big ETA line and a
 * green GO button. Shown after picking a destination (search or AI) and
 * before turn-by-turn starts.
 */
export default function RoutePreviewSheet({
  destinationName,
  address,
  distanceMeters,
  durationSeconds,
  transportMode,
  recalculating = false,
  onTransportChange,
  onGo,
  onClose,
}: Props) {
  return (
    <Glass style={styles.sheet} radius={28} intensity={70}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>
          {destinationName}
        </Text>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={17} color="#d1d5db" />
        </Pressable>
      </View>
      {address ? (
        <Text style={styles.address} numberOfLines={1}>
          {address}
        </Text>
      ) : null}

      <View style={styles.transportRow}>
        {TRANSPORTS.map(({ key, icon }) => {
          const active = key === transportMode;
          return (
            <Pressable
              key={key}
              style={[styles.transportTab, active && styles.transportTabActive]}
              onPress={() => !active && onTransportChange(key)}
            >
              <Ionicons name={icon} size={22} color={active ? '#fff' : 'rgba(255,255,255,0.45)'} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          {recalculating ? (
            <ActivityIndicator color="#0a84ff" style={{ alignSelf: 'flex-start', marginVertical: 12 }} />
          ) : (
            <>
              <Text style={styles.etaBig}>{formatDuration(durationSeconds)}</Text>
              <Text style={styles.etaMeta}>
                {durationSeconds != null ? `${formatArrivalTime(durationSeconds)} llegada` : ''}
                {durationSeconds != null && distanceMeters != null ? ' · ' : ''}
                {formatDistance(distanceMeters)}
              </Text>
            </>
          )}
        </View>
        <Pressable style={[styles.goButton, recalculating && { opacity: 0.5 }]} onPress={onGo} disabled={recalculating}>
          <Text style={styles.goText}>GO</Text>
        </Pressable>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '700' },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  address: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 },
  transportRow: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 4,
    alignSelf: 'flex-start',
  },
  transportTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 11,
  },
  transportTabActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  etaBig: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  etaMeta: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 2 },
  goButton: {
    backgroundColor: '#30d158',
    borderRadius: 18,
    paddingHorizontal: 30,
    paddingVertical: 16,
    shadowColor: '#30d158',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  goText: { color: '#04310f', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
});
