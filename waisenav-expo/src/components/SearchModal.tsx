import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import {
  searchPlaces,
  previewRoute,
  autocompletePlaces,
  getPlaceDetails,
  getFavorites,
  setFavorite,
  getRecentRoutes,
  PlaceResult,
  RoutePreview,
  Favorite,
  RecentRoute,
  AutocompletePrediction,
} from '../services/api';
import { MovementMode } from '../hooks/useMovementMode';

type Props = {
  visible: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
  mode: MovementMode;
  onRouteSelected: (place: PlaceResult, route: RoutePreview) => void;
};

export default function SearchModal({ visible, onClose, location, mode, onRouteSelected }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recents, setRecents] = useState<RecentRoute[]>([]);
  const [searching, setSearching] = useState(false);
  const [routingKey, setRoutingKey] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      getFavorites().then(setFavorites).catch(() => {});
      getRecentRoutes().then(setRecents).catch(() => {});
    }
  }, [visible]);

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      try {
        const preds = await autocompletePlaces(text.trim(), location.lat, location.lng);
        setPredictions(preds);
      } catch {
        // autocomplete is best-effort; full search still works on submit
      }
    }, 350);
  }

  async function routeTo(place: PlaceResult, key: string) {
    setRoutingKey(key);
    try {
      const route = await previewRoute(
        location,
        { lat: place.lat, lng: place.lng },
        mode === 'driving' ? 'driving' : 'walking'
      );
      onRouteSelected(place, route);
      setResults([]);
      setPredictions([]);
      setQuery('');
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo calcular la ruta a ese lugar.');
    } finally {
      setRoutingKey(null);
    }
  }

  async function handleSearch() {
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    setPredictions([]);
    try {
      const found = await searchPlaces(text, location.lat, location.lng);
      setResults(found);
    } catch {
      Alert.alert('Error', 'No se pudo buscar lugares.');
    } finally {
      setSearching(false);
    }
  }

  async function handlePrediction(pred: AutocompletePrediction) {
    setRoutingKey(pred.place_id);
    try {
      const place = await getPlaceDetails(pred.place_id);
      await routeTo(
        { ...place, rating: null, open_now: null },
        pred.place_id
      );
    } catch {
      Alert.alert('Error', 'No se pudo resolver ese lugar.');
      setRoutingKey(null);
    }
  }

  function handleSaveFavorite(place: PlaceResult) {
    Alert.alert('Guardar favorito', place.name, [
      { text: 'Casa', onPress: () => persistFavorite('home', place) },
      { text: 'Trabajo', onPress: () => persistFavorite('work', place) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function persistFavorite(label: string, place: PlaceResult) {
    try {
      const fav = await setFavorite(label, {
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
      });
      setFavorites((prev) => [...prev.filter((f) => f.label !== label), fav]);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el favorito.');
    }
  }

  const showHome = query.trim().length === 0 && results.length === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BlurView tint="systemUltraThinMaterialDark" intensity={80} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Buscar lugar</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#9aa4af" />
            </Pressable>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Gasolinera, parking, restaurante..."
              placeholderTextColor="#6b7280"
              value={query}
              onChangeText={handleQueryChange}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus
            />
            <Pressable style={styles.searchButton} onPress={handleSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
            </Pressable>
          </View>

          {predictions.length > 0 && (
            <View style={styles.predictionsBox}>
              {predictions.map((p) => (
                <Pressable key={p.place_id} style={styles.predictionRow} onPress={() => handlePrediction(p)}>
                  <Ionicons name="location-outline" size={16} color="#9aa4af" style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.predictionMain} numberOfLines={1}>{p.main_text}</Text>
                    {p.secondary_text ? (
                      <Text style={styles.predictionSecondary} numberOfLines={1}>{p.secondary_text}</Text>
                    ) : null}
                  </View>
                  {routingKey === p.place_id && <ActivityIndicator color="#3b82f6" />}
                </Pressable>
              ))}
            </View>
          )}

          {showHome && (
            <>
              <View style={styles.favRow}>
                {(['home', 'work'] as const).map((label) => {
                  const fav = favorites.find((f) => f.label === label);
                  return (
                    <Pressable
                      key={label}
                      style={styles.favChip}
                      onPress={() => {
                        if (fav) {
                          routeTo(
                            {
                              place_id: fav.id,
                              name: fav.name,
                              address: fav.address ?? '',
                              lat: fav.lat,
                              lng: fav.lng,
                              rating: null,
                              open_now: null,
                            },
                            fav.id
                          );
                        } else {
                          Alert.alert(
                            label === 'home' ? 'Casa' : 'Trabajo',
                            'Sin guardar aún. Busca un lugar y pulsa la estrella para guardarlo.'
                          );
                        }
                      }}
                    >
                      <Ionicons
                        name={label === 'home' ? 'home' : 'briefcase'}
                        size={16}
                        color={fav ? '#0a84ff' : '#6b7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.favChipText, !fav && { color: '#6b7280' }]}>
                        {label === 'home' ? 'Casa' : 'Trabajo'}
                      </Text>
                      {routingKey === fav?.id && <ActivityIndicator color="#3b82f6" style={{ marginLeft: 6 }} />}
                    </Pressable>
                  );
                })}
              </View>

              {recents.length > 0 && <Text style={styles.sectionTitle}>Recientes</Text>}
              <FlatList
                data={recents}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.resultRow}
                    onPress={() =>
                      routeTo(
                        {
                          place_id: item.id,
                          name: item.destName,
                          address: '',
                          lat: item.destLat,
                          lng: item.destLng,
                          rating: null,
                          open_now: null,
                        },
                        item.id
                      )
                    }
                  >
                    <Ionicons name="time-outline" size={18} color="#9aa4af" style={{ marginRight: 10 }} />
                    <Text style={styles.resultName} numberOfLines={1}>{item.destName}</Text>
                    {routingKey === item.id ? (
                      <ActivityIndicator color="#3b82f6" />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color="#60a5fa" />
                    )}
                  </Pressable>
                )}
              />
            </>
          )}

          {!showHome && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.place_id}
              style={{ marginTop: 8 }}
              renderItem={({ item }) => (
                <View style={styles.resultRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => routeTo(item, item.place_id)}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultAddress} numberOfLines={1}>{item.address}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleSaveFavorite(item)} hitSlop={8} style={{ marginRight: 12 }}>
                    <Ionicons name="star-outline" size={18} color="#facc15" />
                  </Pressable>
                  {routingKey === item.place_id ? (
                    <ActivityIndicator color="#3b82f6" />
                  ) : (
                    <Pressable onPress={() => routeTo(item, item.place_id)}>
                      <View style={styles.goRow}>
                        <Text style={styles.goText}>Ir</Text>
                        <Ionicons name="chevron-forward" size={16} color="#60a5fa" />
                      </View>
                    </Pressable>
                  )}
                </View>
              )}
              ListEmptyComponent={
                !searching ? <Text style={styles.empty}>Busca algo para ver resultados</Text> : null
              }
            />
          )}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '85%',
    minHeight: '55%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionsBox: { marginTop: 6 },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  predictionMain: { color: '#fff', fontSize: 14, fontWeight: '600' },
  predictionSecondary: { color: '#9aa4af', fontSize: 12 },
  favRow: { flexDirection: 'row', marginTop: 14, marginBottom: 4 },
  favChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 10,
  },
  favChipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: '#9aa4af', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  resultName: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  resultAddress: { color: '#9aa4af', fontSize: 12, marginTop: 2 },
  goRow: { flexDirection: 'row', alignItems: 'center' },
  goText: { color: '#60a5fa', fontWeight: '600' },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
});
