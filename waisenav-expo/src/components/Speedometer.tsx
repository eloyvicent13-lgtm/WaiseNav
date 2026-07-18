import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Glass from './Glass';

type Props = {
  speedKmh: number;
  limitKmh?: number | null;
};

export default function Speedometer({ speedKmh, limitKmh = null }: Props) {
  const over = limitKmh != null && speedKmh > limitKmh + 3;
  return (
    <View style={{ alignItems: 'center' }}>
      <Glass style={[styles.container, over && styles.overLimit]} radius={39} intensity={60}>
        <Text style={[styles.value, over && { color: '#ff453a' }]}>
          {Math.max(0, Math.round(speedKmh))}
        </Text>
        <Text style={styles.unit}>km/h</Text>
      </Glass>
      {limitKmh != null && (
        <View style={styles.limitSign}>
          <Text style={styles.limitText}>{limitKmh}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.9)',
  },
  overLimit: { borderColor: '#ff453a' },
  value: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 28, letterSpacing: -0.5 },
  unit: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  limitSign: {
    marginTop: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#d70015',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitText: { color: '#000', fontSize: 15, fontWeight: '900' },
});
