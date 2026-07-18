import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Glass from './Glass';
import { RouteStep } from '../services/api';
import { formatDistance, formatDuration, formatArrivalTime } from '../utils/geo';

type MCIName = keyof typeof MaterialCommunityIcons.glyphMap;

function maneuverIcon(type: string, modifier: string | null): MCIName {
  if (type === 'arrive') return 'flag-checkered';
  if (type === 'roundabout' || type === 'rotary') return 'rotate-right';
  switch (modifier) {
    case 'left':
    case 'sharp left':
      return 'arrow-left-top-bold';
    case 'right':
    case 'sharp right':
      return 'arrow-right-top-bold';
    case 'slight left':
      return 'arrow-top-left-thick';
    case 'slight right':
      return 'arrow-top-right-thick';
    case 'uturn':
      return 'arrow-u-down-left-bold';
    default:
      return 'arrow-up-bold';
  }
}

type Props = {
  step: RouteStep | null;
  distanceToManeuver: number | null;
  nextStep: RouteStep | null;
  remainingSeconds: number;
  remainingMeters: number;
  onExit: () => void;
};

/**
 * Active turn-by-turn HUD: green glass instruction banner on top (current
 * maneuver + the one after it), arrival stats card at the bottom.
 */
export default function NavigationHUD({
  step,
  distanceToManeuver,
  nextStep,
  remainingSeconds,
  remainingMeters,
  onExit,
}: Props) {
  return (
    <>
      {step && (
        <Glass style={styles.banner} radius={24} intensity={65} tintColor="rgba(18,110,64,0.62)">
          <View style={styles.bannerMain}>
            <MaterialCommunityIcons
              name={maneuverIcon(step.type, step.modifier)}
              size={46}
              color="#fff"
              style={styles.arrow}
            />
            <View style={{ flex: 1 }}>
              {distanceToManeuver != null && (
                <Text style={styles.maneuverDistance}>{formatDistance(distanceToManeuver)}</Text>
              )}
              <Text style={styles.instruction} numberOfLines={2}>
                {step.instruction}
              </Text>
            </View>
          </View>
          {nextStep && (
            <View style={styles.nextRow}>
              <MaterialCommunityIcons
                name={maneuverIcon(nextStep.type, nextStep.modifier)}
                size={18}
                color="rgba(255,255,255,0.8)"
                style={styles.nextArrow}
              />
              <Text style={styles.nextText} numberOfLines={1}>
                Después: {nextStep.instruction}
              </Text>
            </View>
          )}
        </Glass>
      )}

      <Glass style={styles.footer} radius={28} intensity={70}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatArrivalTime(remainingSeconds)}</Text>
          <Text style={styles.statLabel}>llegada</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatDuration(remainingSeconds)}</Text>
          <Text style={styles.statLabel}>restante</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatDistance(remainingMeters)}</Text>
          <Text style={styles.statLabel}>distancia</Text>
        </View>
        <Pressable style={styles.exitButton} onPress={onExit}>
          <Text style={styles.exitText}>Salir</Text>
        </Pressable>
      </Glass>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerMain: { flexDirection: 'row', alignItems: 'center' },
  arrow: { marginRight: 14, width: 52, textAlign: 'center' },
  maneuverDistance: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700' },
  instruction: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  nextArrow: { marginRight: 8 },
  nextText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', flex: 1 },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  statCol: { flex: 1 },
  statValue: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  statLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 },
  exitButton: {
    backgroundColor: 'rgba(255,69,58,0.9)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  exitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
