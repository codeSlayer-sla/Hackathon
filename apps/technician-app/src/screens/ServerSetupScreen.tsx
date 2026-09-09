import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { setServerUrl, looksLikeUrl } from '../config/serverConfig';
import { getOperatingCountry, setOperatingCountry } from '../db/database';

interface Props {
  initialUrl: string | null;
  onDone: () => void;
  allowSkip: boolean;
}

export default function ServerSetupScreen({ initialUrl, onDone, allowSkip }: Props) {
  const [url, setUrl] = useState(initialUrl ?? 'http://');
  const [country, setCountry] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getOperatingCountry().then((c) => { if (c) setCountry(c); });
  }, []);

  async function handleTest() {
    if (!looksLikeUrl(url)) { setError('URL inválida. Ejemplo: http://192.168.1.42:8005'); return; }
    setError('');
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch(`${url.trim().replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(5000) });
      setTestResult(resp.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    }
    setTesting(false);
  }

  async function handleSave() {
    if (!looksLikeUrl(url)) { setError('URL inválida. Ejemplo: http://192.168.1.42:8005'); return; }
    await setServerUrl(url);
    if (country.trim()) await setOperatingCountry(country);
    onDone();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.logo}><Text style={styles.logoText}>PHILIPS</Text></View>
          <Text style={styles.title}>Configuración</Text>

          <Text style={styles.label}>Servidor</Text>
          <Text style={styles.subtitle}>
            Dirección del servidor Installed Base en tu red local (laptop corriendo docker compose).
          </Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.42:8005"
            placeholderTextColor="#4a5568"
            value={url}
            onChangeText={(v) => { setUrl(v); setTestResult(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
            {testing
              ? <ActivityIndicator color="#8fa3bf" />
              : <Text style={styles.testBtnText}>Probar conexión</Text>
            }
          </TouchableOpacity>

          {testResult === 'ok' && <Text style={styles.testOk}>✓ Servidor alcanzable</Text>}
          {testResult === 'fail' && <Text style={styles.testFail}>✗ No se pudo conectar (puedes guardar igual y probar después)</Text>}

          <Text style={[styles.label, { marginTop: 20 }]}>País donde estás operando</Text>
          <Text style={styles.subtitle}>
            Se usa para todas las visitas que registres -- así la IA nunca tiene que adivinar el país.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Panama"
            placeholderTextColor="#4a5568"
            value={country}
            onChangeText={setCountry}
            autoCapitalize="words"
          />

          <TouchableOpacity style={styles.btn} onPress={handleSave}>
            <Text style={styles.btnText}>Guardar</Text>
          </TouchableOpacity>

          {allowSkip && (
            <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
              <Text style={styles.skipBtnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#131929', borderRadius: 16, padding: 32, borderWidth: 1, borderColor: '#253060' },
  logo: { backgroundColor: '#1F5EAA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', marginBottom: 20 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  title: { color: '#e2e8f0', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  label: { color: '#e2e8f0', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#8fa3bf', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  input: { backgroundColor: '#1a2240', borderWidth: 1, borderColor: '#253060', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, color: '#e2e8f0', fontSize: 15, marginBottom: 12 },
  error: { color: '#fc8181', fontSize: 13, textAlign: 'center', marginBottom: 10 },
  testBtn: { paddingVertical: 10, alignItems: 'center' },
  testBtnText: { color: '#8fa3bf', fontSize: 13, fontWeight: '600' },
  testOk: { color: '#22c55e', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  testFail: { color: '#fc8181', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  btn: { backgroundColor: '#1F5EAA', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  skipBtnText: { color: '#4a5568', fontSize: 13 },
});
