import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { ensureLLM, ensureWhisper, runTranscription } from '../qvac/models';
import { extractFromTranscript, type ExtractionResult } from '../qvac/extraction';
import { insertObservations } from '../db/database';

interface Message { role: 'user' | 'agent'; text: string; }

interface Props {
  technicianName: string;
  onSaved: () => void;
}

type ModelState = 'idle' | 'loading-llm' | 'loading-whisper' | 'ready' | 'error';

export default function CaptureScreen({ technicianName, onSaved }: Props) {
  const [modelState, setModelState] = useState<ModelState>('idle');
  const [loadProgress, setLoadProgress] = useState(0);
  const [llmId, setLlmId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadModels();
  }, []);

  async function loadModels() {
    setModelState('loading-llm');
    try {
      const id = await ensureLLM((pct) => setLoadProgress(Math.round(pct)));
      setLlmId(id);
      setModelState('ready');
      setMessages([{ role: 'agent', text: '¡Hola! Describe la visita que realizaste: hospital, equipos que viste, marcas, antigüedad. Yo extraigo los datos automáticamente.' }]);
    } catch (e: any) {
      setModelState('error');
    }
  }

  async function sendMessage(text: string, source: 'text' | 'voice' = 'text') {
    if (!llmId || !text.trim()) return;
    setProcessing(true);
    const newTranscript = [...transcript, text.trim()];
    setTranscript(newTranscript);
    setMessages((prev) => [...prev, { role: 'user', text: text.trim() }]);
    setInput('');

    try {
      const result: ExtractionResult = await extractFromTranscript(llmId, newTranscript);

      if (result.ready_to_save && result.customer && result.equipment.length > 0) {
        const saved = await insertObservations(
          result.customer,
          result.city,
          result.country,
          result.equipment,
          technicianName,
          source
        );
        const summary = saved.map((o) => `${o.quantity ?? '?'}x ${o.modality}${o.brand ? ` (${o.brand})` : ''}`).join(', ');
        setMessages((prev) => [...prev, {
          role: 'agent',
          text: `✅ Guardado para ${result.customer}: ${summary}. Datos listos para sincronizar con el servidor Philips.`,
        }]);
        setTranscript([]);
        onSaved();
      } else {
        const follow = result.follow_up_question ?? '¿Puedes darme más detalles?';
        setMessages((prev) => [...prev, { role: 'agent', text: follow }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'agent', text: `Error: ${e.message}` }]);
    } finally {
      setProcessing(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function resetSession() {
    setTranscript([]);
    setMessages([{ role: 'agent', text: 'Sesión reiniciada. Describe tu próxima visita.' }]);
  }

  if (modelState === 'loading-llm') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1F5EAA" size="large" />
        <Text style={styles.loadText}>Cargando modelo LLM local… {loadProgress}%</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${loadProgress}%` }]} />
        </View>
        <Text style={styles.hint}>Solo la primera vez (~770 MB). Las siguientes es inmediato.</Text>
      </View>
    );
  }

  if (modelState === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se pudo cargar el modelo QVAC.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadModels}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Capturar visita</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>● IA local</Text></View>
        <TouchableOpacity onPress={resetSession}>
          <Text style={styles.resetText}>Nueva sesión</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
            <Text style={styles.bubbleRole}>{m.role === 'user' ? technicianName : 'AI Mesh'}</Text>
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {processing && (
          <View style={styles.bubbleAgent}>
            <ActivityIndicator color="#00C4CC" size="small" />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          placeholder="Describe lo que observaste…"
          placeholderTextColor="#4a5568"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!processing && modelState === 'ready'}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || processing) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || processing}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  center: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadText: { color: '#e2e8f0', marginTop: 16, fontSize: 15 },
  progressBar: { width: '80%', height: 6, backgroundColor: '#253060', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1F5EAA', borderRadius: 4 },
  hint: { color: '#4a5568', fontSize: 12, textAlign: 'center', marginTop: 12 },
  errorText: { color: '#fc8181', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: '#1F5EAA', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { color: '#fff', fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#253060', gap: 8 },
  headerTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { backgroundColor: '#0f2318', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { color: '#86efac', fontSize: 11, fontWeight: '700' },
  resetText: { color: '#8fa3bf', fontSize: 13 },
  chat: { flex: 1 },
  bubble: { borderRadius: 12, padding: 12, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#1a2240', alignSelf: 'flex-end' },
  bubbleAgent: { backgroundColor: '#131929', borderWidth: 1, borderColor: '#253060', alignSelf: 'flex-start' },
  bubbleRole: { color: '#8fa3bf', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#253060' },
  textInput: { flex: 1, backgroundColor: '#131929', borderWidth: 1, borderColor: '#253060', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, color: '#e2e8f0', fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: '#1F5EAA', borderRadius: 10, width: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#253060' },
  sendIcon: { color: '#fff', fontSize: 18 },
});
