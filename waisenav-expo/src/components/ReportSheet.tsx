import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createReport, ReportType } from '../services/api';

const OPTIONS: { type: ReportType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
  { type: 'radar_movil', label: 'Radar móvil', icon: 'radar', color: '#ff9f0a' },
  { type: 'accidente', label: 'Accidente', icon: 'car-emergency', color: '#ff453a' },
  { type: 'obstaculo', label: 'Obstáculo', icon: 'alert-octagon', color: '#facc15' },
  { type: 'policia', label: 'Policía', icon: 'police-badge', color: '#0a84ff' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
  onReported: () => void;
};

export default function ReportSheet({ visible, onClose, location, onReported }: Props) {
  const [sending, setSending] = useState<ReportType | null>(null);

  async function handleReport(type: ReportType) {
    setSending(type);
    try {
      await createReport(type, location.lat, location.lng);
      onReported();
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    } finally {
      setSending(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BlurView tint="systemUltraThinMaterialDark" intensity={80} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Reportar</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#9aa4af" />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.type}
                style={styles.option}
                onPress={() => handleReport(opt.type)}
                disabled={sending !== null}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${opt.color}26`, borderColor: opt.color }]}>
                  <MaterialCommunityIcons name={opt.icon} size={30} color={opt.color} />
                </View>
                <Text style={styles.optionLabel}>{sending === opt.type ? '...' : opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: 'rgba(11,15,20,0.55)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', width: '23%' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 8,
  },
  optionLabel: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
