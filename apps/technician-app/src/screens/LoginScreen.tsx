import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { findCachedTechnicianByPinHash, getCachedPepper } from '../db/database';
import { refreshRoster } from '../sync/syncService';
import { getServerUrl } from '../config/serverConfig';

interface Props {
  onLogin: (token: string, name: string) => void;
  onEditServer: () => void;
}

// Last-resort fallback ONLY for a device that has never once reached the
// server (getCachedPepper() returns null) -- e.g. first run, no connectivity
// yet. The moment a real roster is cached, this is never consulted again;
// it never overrides or bypasses cached data.
const BOOTSTRAP_PINS: Record<string, { technician_id: string; name: string }> = {
  '1234': { technician_id: 'tech-01', name: 'Field User 01' },
  '2345': { technician_id: 'tech-02', name: 'Sales User 02' },
  '3456': { technician_id: 'tech-03', name: 'Field User 03' },
};

export default function LoginScreen({ onLogin, onEditServer }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (pin.length < 4) { setError('PIN debe tener al menos 4 dígitos'); return; }
    setLoading(true);
    setError('');

    // Try server first
    const server = await getServerUrl();
    try {
      if (!server) throw new Error('no server configured');
      const resp = await fetch(`${server}/auth/technician`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const data = await resp.json();
        // Best-effort: refresh the offline login cache now that we have a
        // valid token, so a later offline login has fresh PIN hashes.
        refreshRoster(data.token);
        onLogin(data.token, data.name);
        return;
      }
      if (resp.status === 401) { setError('PIN incorrecto'); setLoading(false); return; }
    } catch {
      // server unreachable — fall through to offline mode
    }

    // Offline fallback: hash the entered PIN with the last-cached pepper and
    // compare against the last-cached roster (populated on a previous online
    // login).
    const pepper = await getCachedPepper();
    if (!pepper) {
      // Never synced even once -- last resort so the demo isn't dead in the
      // water on a fresh install with no connectivity. Only reachable here,
      // never once a real roster exists.
      const bootstrap = BOOTSTRAP_PINS[pin];
      if (bootstrap) {
        onLogin(`offline-${bootstrap.technician_id}-${Date.now()}`, `${bootstrap.name} (offline-fallback)`);
      } else {
        setError('Sin conexión al servidor y sin datos guardados para modo offline. Inicia sesión online al menos una vez.');
      }
      setLoading(false);
      return;
    }
    const pinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${pin}${pepper}`);
    const technician = await findCachedTechnicianByPinHash(pinHash);
    if (technician) {
      onLogin(`offline-${technician.technician_id}-${Date.now()}`, `${technician.name} (offline)`);
    } else {
      setError('PIN incorrecto (sin conexión al servidor)');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>PHILIPS</Text>
        </View>
        <Text style={styles.title}>Technician App</Text>
        <Text style={styles.subtitle}>Ingresa tu PIN para continuar</Text>

        <TextInput
          style={styles.input}
          placeholder="PIN"
          placeholderTextColor="#4a5568"
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
          onSubmitEditing={handleLogin}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Ingresar</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Demo: 1234 · 2345 · 3456</Text>

        <TouchableOpacity onPress={onEditServer} style={styles.serverLink}>
          <Ionicons name="settings-outline" size={13} color="#4a5568" />
          <Text style={styles.serverLinkText}>Configurar servidor</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#131929', borderRadius: 16, padding: 32, borderWidth: 1, borderColor: '#253060' },
  logo: { backgroundColor: '#1F5EAA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', marginBottom: 20 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  title: { color: '#e2e8f0', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: '#8fa3bf', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  input: { backgroundColor: '#1a2240', borderWidth: 1, borderColor: '#253060', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, color: '#e2e8f0', fontSize: 20, letterSpacing: 8, textAlign: 'center', marginBottom: 12 },
  error: { color: '#fc8181', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  btn: { backgroundColor: '#1F5EAA', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { color: '#4a5568', fontSize: 12, textAlign: 'center', marginTop: 20 },
  serverLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16 },
  serverLinkText: { color: '#4a5568', fontSize: 12 },
});
