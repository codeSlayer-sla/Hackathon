import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';

interface Props {
  onLogin: (token: string, name: string) => void;
}

// PINs demo: 1234 / 2345 / 3456
// When online: calls Philips server. Offline: accepts demo PINs locally.
const OFFLINE_PINS: Record<string, string> = {
  '1234': 'Field User 01',
  '2345': 'Sales User 02',
  '3456': 'Field User 03',
};

const PHILIPS_SERVER = process.env.EXPO_PUBLIC_PHILIPS_SERVER ?? 'http://192.168.1.100:8005';

export default function LoginScreen({ onLogin }: Props) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (pin.length < 4) { setError('PIN debe tener al menos 4 dígitos'); return; }
    setLoading(true);
    setError('');

    // Try server first
    try {
      const resp = await fetch(`${PHILIPS_SERVER}/auth/technician`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const data = await resp.json();
        onLogin(data.token, data.name);
        return;
      }
      if (resp.status === 401) { setError('PIN incorrecto'); setLoading(false); return; }
    } catch {
      // server unreachable — fall through to offline mode
    }

    // Offline fallback
    const name = OFFLINE_PINS[pin];
    if (name) {
      onLogin(`offline-${pin}-${Date.now()}`, `${name} (offline)`);
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
});
