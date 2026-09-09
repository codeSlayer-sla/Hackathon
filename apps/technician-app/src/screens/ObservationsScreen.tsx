import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { listObservations, type LocalObservation } from '../db/database';

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  synced: '#22c55e',
  failed: '#ef4444',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
};

export default function ObservationsScreen() {
  const [observations, setObservations] = useState<LocalObservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listObservations().then((rows) => { setObservations(rows); setLoading(false); });
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#1F5EAA" /></View>;
  }

  if (observations.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No hay observaciones todavía.</Text>
        <Text style={styles.emptySub}>Ve a "Capturar" para agregar la primera visita.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={observations}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      style={{ backgroundColor: '#0a0f1e' }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.customer}>{item.customer}</Text>
            <View style={[styles.syncBadge, { backgroundColor: STATUS_COLOR[item.sync_status] + '22' }]}>
              <Text style={[styles.syncText, { color: STATUS_COLOR[item.sync_status] }]}>
                {item.sync_status === 'pending' ? '⏳ pendiente' : item.sync_status === 'synced' ? '✓ sincronizado' : '✗ error'}
              </Text>
            </View>
          </View>
          <Text style={styles.location}>
            {[item.city, item.country].filter(Boolean).join(', ') || 'Ubicación no especificada'}
          </Text>
          <View style={styles.equipRow}>
            <Text style={styles.modality}>{item.quantity ? `${item.quantity}x ` : ''}{item.modality}</Text>
            {item.brand ? <Text style={styles.brand}>{item.brand}{item.model ? ` ${item.model}` : ''}</Text> : null}
            {item.approx_age_years ? <Text style={styles.age}>{item.approx_age_years} años</Text> : null}
            <View style={[styles.confBadge, { backgroundColor: CONFIDENCE_COLOR[item.confidence] + '22' }]}>
              <Text style={[styles.confText, { color: CONFIDENCE_COLOR[item.confidence] }]}>{item.confidence}</Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.meta}>{item.observer} · {item.source} · {item.visit_date}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptySub: { color: '#8fa3bf', fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: '#131929', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#253060' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  customer: { color: '#e2e8f0', fontSize: 15, fontWeight: '700', flex: 1 },
  syncBadge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8 },
  syncText: { fontSize: 11, fontWeight: '700' },
  location: { color: '#8fa3bf', fontSize: 12, marginBottom: 8 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modality: { color: '#00C4CC', fontWeight: '700', fontSize: 14 },
  brand: { color: '#e2e8f0', fontSize: 13 },
  age: { color: '#8fa3bf', fontSize: 12 },
  confBadge: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8 },
  confText: { fontSize: 11, fontWeight: '600' },
  footer: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#1a2240', paddingTop: 6 },
  meta: { color: '#4a5568', fontSize: 11 },
});
