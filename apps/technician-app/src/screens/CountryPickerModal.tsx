import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
} from 'react-native';
import { COUNTRIES } from '../config/countries';

interface Props {
  visible: boolean;
  selected: string | null;
  onSelect: (country: string) => void;
  onClose: () => void;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function CountryPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return COUNTRIES;
    const q = normalize(query);
    return COUNTRIES.filter((c) => normalize(c).includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Selecciona un país</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Buscar…"
          placeholderTextColor="#4a5568"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <FlatList
          data={filtered}
          keyExtractor={(c) => c}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, item === selected && styles.rowSelected]}
              onPress={() => { onSelect(item); onClose(); }}
            >
              <Text style={[styles.rowText, item === selected && styles.rowTextSelected]}>{item}</Text>
              {item === selected && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin resultados.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  title: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  close: { color: '#8fa3bf', fontSize: 14 },
  search: { marginHorizontal: 20, marginBottom: 8, backgroundColor: '#1a2240', borderWidth: 1, borderColor: '#253060', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, color: '#e2e8f0', fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a2240' },
  rowSelected: { backgroundColor: '#131929' },
  rowText: { color: '#e2e8f0', fontSize: 15 },
  rowTextSelected: { color: '#00C4CC', fontWeight: '700' },
  check: { color: '#00C4CC', fontSize: 16, fontWeight: '700' },
  empty: { color: '#4a5568', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
