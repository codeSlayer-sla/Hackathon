import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { countPending } from '../db/database';
import { syncToServer, isServerReachable, refreshRoster, type SyncResult } from '../sync/syncService';

interface Props { token: string; }

export default function SyncScreen({ token }: Props) {
  const [pending, setPending] = useState(0);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  async function refresh() {
    const [count, online] = await Promise.all([countPending(), isServerReachable()]);
    setPending(count);
    setServerOnline(online);
    if (online && !token.startsWith('offline-')) {
      refreshRoster(token);
    }
  }

  async function doSync() {
    if (token.startsWith('offline-')) {
      setLastResult({ pushed: 0, accepted: 0, failed: 0, error: 'Modo offline: no hay token válido del servidor.' });
      return;
    }
    setSyncing(true);
    setLastResult(null);
    const result = await syncToServer(token);
    setLastResult(result);
    setSyncing(false);
    await refresh();
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Estado del servidor Philips</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: serverOnline === null ? '#4a5568' : serverOnline ? '#22c55e' : '#ef4444' }]} />
          <Text style={styles.statusText}>
            {serverOnline === null ? 'Verificando…' : serverOnline ? 'Online' : 'Sin conexión'}
          </Text>
          <TouchableOpacity onPress={refresh}><Text style={styles.refresh}>↻ Verificar</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Observaciones pendientes</Text>
        <Text style={styles.pendingCount}>{pending}</Text>
        <Text style={styles.pendingSub}>registros capturados offline esperando sincronización</Text>
      </View>

      <TouchableOpacity
        style={[styles.syncBtn, (!serverOnline || syncing || pending === 0) && styles.syncBtnDisabled]}
        onPress={doSync}
        disabled={!serverOnline || syncing || pending === 0}
      >
        {syncing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.syncBtnText}>
              {pending === 0 ? '✓ Todo sincronizado' : `Sincronizar ${pending} registro${pending !== 1 ? 's' : ''}`}
            </Text>
        }
      </TouchableOpacity>

      {lastResult && (
        <View style={[styles.result, lastResult.error ? styles.resultError : styles.resultOk]}>
          {lastResult.error
            ? <Text style={styles.resultText}>Error: {lastResult.error}</Text>
            : <Text style={styles.resultText}>
                ✅ {lastResult.accepted} aceptados · {lastResult.failed} fallidos de {lastResult.pushed} enviados
              </Text>
          }
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
        <Text style={styles.infoText}>
          • La IA corre localmente (QVAC on-device){'\n'}
          • Los datos se guardan en SQLite local{'\n'}
          • Cuando hay red, se sincronizan al servidor Philips{'\n'}
          • En modo offline, capturas igual — sync después
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', padding: 16, gap: 12 },
  card: { backgroundColor: '#131929', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#253060' },
  sectionLabel: { color: '#8fa3bf', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: '#e2e8f0', fontSize: 15, fontWeight: '600', flex: 1 },
  refresh: { color: '#8fa3bf', fontSize: 13 },
  pendingCount: { color: '#00C4CC', fontSize: 48, fontWeight: '800', textAlign: 'center' },
  pendingSub: { color: '#8fa3bf', fontSize: 13, textAlign: 'center' },
  syncBtn: { backgroundColor: '#1F5EAA', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  syncBtnDisabled: { backgroundColor: '#1a2240' },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  result: { borderRadius: 10, padding: 14 },
  resultOk: { backgroundColor: '#14532d' },
  resultError: { backgroundColor: '#450a0a' },
  resultText: { color: '#e2e8f0', fontSize: 14 },
  infoCard: { backgroundColor: '#0f1828', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1a2240' },
  infoTitle: { color: '#8fa3bf', fontWeight: '700', marginBottom: 8 },
  infoText: { color: '#4a5568', fontSize: 13, lineHeight: 22 },
});
