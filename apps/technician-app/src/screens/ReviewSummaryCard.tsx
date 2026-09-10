import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ReviewSummary } from '../capture/sessionRunner';

export default function ReviewSummaryCard({ review }: { review: ReviewSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>📝 Listo para guardar</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.value}>{review.customer}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Ubicación</Text>
        <Text style={styles.value}>{review.location}</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.label}>Equipos</Text>
      {review.equipment.map((e, i) => (
        <View key={i} style={styles.equipRow}>
          <Text style={styles.equipModality}>
            {e.quantity ?? '?'}x {e.modality}
          </Text>
          {(e.brand || e.model) && (
            <Text style={styles.equipDetail}>
              {[e.brand, e.model].filter(Boolean).join(' ')}
            </Text>
          )}
          {e.approxAgeYears != null && (
            <Text style={styles.equipAge}>~{e.approxAgeYears} años</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#131929', borderWidth: 1, borderColor: '#3a2f14', borderRadius: 12, padding: 14, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  headerText: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  label: { color: '#8fa3bf', fontSize: 12, fontWeight: '600' },
  value: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#253060', marginVertical: 4 },
  equipRow: { paddingVertical: 4, gap: 2 },
  equipModality: { color: '#00C4CC', fontSize: 14, fontWeight: '700' },
  equipDetail: { color: '#e2e8f0', fontSize: 13 },
  equipAge: { color: '#8fa3bf', fontSize: 12 },
});
