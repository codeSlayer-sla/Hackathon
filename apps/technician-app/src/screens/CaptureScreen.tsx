import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { ensureLLM, ensureWhisper, runTranscription, getLoadedLLMId } from '../qvac/models';
import { startConversation } from '../qvac/extraction';
import {
  createCaptureSession,
  listCaptureSessions,
  getCaptureSession,
  updateCaptureSession,
  type CaptureSessionSummary,
  type CaptureSessionStatus,
} from '../db/database';
import { runSessionTurn, confirmSession, discardSessionIfDone, type DisplayMessage } from '../capture/sessionRunner';

interface Props {
  technicianName: string;
  onSaved: () => void;
}

type ModelState = 'idle' | 'loading-llm' | 'ready' | 'error';

const GREETING: DisplayMessage = {
  role: 'agent',
  text: '¡Hola! Describe la visita que realizaste: hospital, equipos que viste, marcas, antigüedad. Yo extraigo los datos automáticamente.',
};

export default function CaptureScreen({ technicianName, onSaved }: Props) {
  // Preloaded from App.tsx on boot -- if it already finished (the common
  // case, since it had the whole login screen as a head start), skip
  // straight to 'ready' instead of flashing a loading screen for a model
  // that's already sitting there loaded.
  const [modelState, setModelState] = useState<ModelState>(() => (getLoadedLLMId() ? 'ready' : 'idle'));
  const [loadProgress, setLoadProgress] = useState(0);
  const [llmId, setLlmId] = useState<string | null>(() => getLoadedLLMId());
  const [sessions, setSessions] = useState<CaptureSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  useEffect(() => {
    if (modelState !== 'ready') loadModels();
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModels() {
    setModelState('loading-llm');
    try {
      const id = await ensureLLM((pct) => setLoadProgress(Math.round(pct)));
      setLlmId(id);
      setModelState('ready');
    } catch {
      setModelState('error');
    }
  }

  async function refreshSessions() {
    setSessions(await listCaptureSessions());
  }

  async function handleNewSession() {
    const id = await createCaptureSession('Nueva visita', JSON.stringify(startConversation()));
    // Greeting is display-only -- it's never part of the model-facing history.
    await updateCaptureSession(id, { messagesJson: JSON.stringify([GREETING]) });
    setSessions(await listCaptureSessions());
    setActiveSessionId(id);
  }

  async function handleBackToList(sessionId: number) {
    await discardSessionIfDone(sessionId);
    setActiveSessionId(null);
    await refreshSessions();
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

  if (activeSessionId != null && llmId) {
    return (
      <CaptureConversation
        key={activeSessionId}
        sessionId={activeSessionId}
        llmId={llmId}
        technicianName={technicianName}
        onBack={() => handleBackToList(activeSessionId)}
        onSaved={onSaved}
      />
    );
  }

  return (
    <SessionListView
      sessions={sessions}
      onRefresh={refreshSessions}
      onSelect={setActiveSessionId}
      onCreate={handleNewSession}
    />
  );
}

function SessionListView({
  sessions,
  onRefresh,
  onSelect,
  onCreate,
}: {
  sessions: CaptureSessionSummary[];
  onRefresh: () => void;
  onSelect: (id: number) => void;
  onCreate: () => void;
}) {
  // Any session running in the background can flip from "processing" while
  // this list is on screen -- keep it live without a manual pull-to-refresh.
  useEffect(() => {
    if (!sessions.some((s) => s.status === 'processing')) return;
    const t = setTimeout(onRefresh, 1500);
    return () => clearTimeout(t);
  }, [sessions, onRefresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Visitas</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>● IA local</Text></View>
        <TouchableOpacity style={styles.newBtn} onPress={onCreate}>
          <Text style={styles.newBtnText}>+ Nueva visita</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No hay visitas en curso.</Text>
          <Text style={styles.emptySub}>Toca "+ Nueva visita" para empezar a describir una.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.sessionCard} onPress={() => onSelect(item.id)}>
              <Text style={styles.sessionLabel}>{item.label}</Text>
              {item.status === 'processing' ? (
                <View style={styles.processingRow}>
                  <ActivityIndicator color="#00C4CC" size="small" />
                  <Text style={styles.processingText}>Procesando…</Text>
                </View>
              ) : item.status === 'review' ? (
                <Text style={styles.reviewText}>📝 Esperando confirmación</Text>
              ) : item.status === 'done' ? (
                <Text style={styles.doneText}>✅ Listo -- toca para ver</Text>
              ) : (
                <Text style={styles.idleText}>Esperando respuesta del técnico</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function CaptureConversation({
  sessionId,
  llmId,
  technicianName,
  onBack,
  onSaved,
}: {
  sessionId: number;
  llmId: string;
  technicianName: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<CaptureSessionStatus>('idle');
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [recordingObj, setRecordingObj] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef(false);
  const onSavedFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getCaptureSession(sessionId);
      if (cancelled || !session) return;
      const stored: DisplayMessage[] = JSON.parse(session.messages_json);
      setMessages(stored.length > 0 ? stored : [GREETING]);
      setStatus(session.status);
      setLoaded(true);
      if (session.status === 'processing') startPolling();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  useEffect(() => {
    if (status === 'done' && !onSavedFiredRef.current) {
      onSavedFiredRef.current = true;
      onSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    void poll();
  }

  async function poll() {
    const session = await getCaptureSession(sessionId);
    if (!session) {
      pollingRef.current = false;
      return;
    }
    setMessages(JSON.parse(session.messages_json));
    setStatus(session.status);
    if (session.status === 'processing') {
      setTimeout(poll, 1200);
    } else {
      pollingRef.current = false;
    }
  }

  async function sendMessage(text: string, source: 'text' | 'voice' = 'text') {
    if (!text.trim() || status === 'processing') return;
    setMessages((prev) => [...prev, { role: 'user', text: text.trim() }]);
    setStatus('processing');
    setInput('');
    // Fire-and-forget: this keeps running (and persists its result) even if
    // the technician navigates away from this session before it resolves.
    runSessionTurn(sessionId, llmId, text.trim(), source).catch(() => {});
    startPolling();
  }

  async function handleConfirm() {
    if (status !== 'review') return;
    setStatus('processing');
    await confirmSession(sessionId, technicianName);
    const session = await getCaptureSession(sessionId);
    if (session) {
      setMessages(JSON.parse(session.messages_json));
      setStatus(session.status);
    }
  }

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permiso denegado', 'Se necesita permiso de micrófono para grabar.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecordingObj(rec);
      setIsRecording(true);
    } catch (e: any) {
      Alert.alert('Error', 'No se pudo iniciar la grabación: ' + e.message);
    }
  }

  async function stopRecording() {
    if (!recordingObj) return;
    setIsRecording(false);
    setTranscribing(true);
    try {
      await recordingObj.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingObj.getURI();
      setRecordingObj(null);
      if (!uri) throw new Error('No se obtuvo URI de audio');
      // QVAC's native worker wants a plain filesystem path, not a file://
      // URI (expo-av's getURI() always returns the latter) -- same
      // normalization the SDK itself does internally for its own paths.
      const audioPath = uri.replace(/^file:\/\//, '');
      const wId = await ensureWhisper();
      const text = await runTranscription(wId, audioPath);
      if (text.trim()) {
        await sendMessage(text, 'voice');
      }
    } catch (e: any) {
      Alert.alert('Error de transcripción', e.message);
    } finally {
      setTranscribing(false);
    }
  }

  const processing = status === 'processing';
  const review = status === 'review';
  const done = status === 'done';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>‹ Visitas</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>Capturar visita</Text>
        <View style={{ width: 60 }} />
      </View>

      {!loaded ? (
        <View style={styles.center}><ActivityIndicator color="#1F5EAA" /></View>
      ) : (
        <>
          <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAgent]}>
                <Text style={styles.bubbleRole}>{m.role === 'user' ? technicianName : 'Phil'}</Text>
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            ))}
            {processing && (
              <View style={styles.bubbleAgent}>
                <ActivityIndicator color="#00C4CC" size="small" />
              </View>
            )}
          </ScrollView>

          {done ? (
            <View style={styles.inputRow}>
              <TouchableOpacity style={[styles.sendBtn, { flex: 1 }]} onPress={onBack}>
                <Text style={styles.doneBtnText}>Volver a Visitas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {review && (
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                    <Text style={styles.confirmBtnText}>✅ Confirmar y guardar</Text>
                  </TouchableOpacity>
                  <Text style={styles.confirmHint}>¿Algo mal? Escríbelo abajo en vez de confirmar.</Text>
                </View>
              )}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={review ? 'O escribe una corrección…' : 'Describe lo que observaste…'}
                  placeholderTextColor="#4a5568"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  editable={!processing && !transcribing}
                />
                <TouchableOpacity
                  style={[styles.micBtn, isRecording && styles.micBtnRecording]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={processing || transcribing}
                >
                  {transcribing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.micIcon}>{isRecording ? '⏹' : '🎤'}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, (!input.trim() || processing || transcribing) && styles.sendBtnDisabled]}
                  onPress={() => sendMessage(input)}
                  disabled={!input.trim() || processing || transcribing}
                >
                  <Text style={styles.sendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
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
  headerTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: '700' },
  backText: { color: '#8fa3bf', fontSize: 14, width: 60 },
  badge: { backgroundColor: '#0f2318', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { color: '#86efac', fontSize: 11, fontWeight: '700' },
  newBtn: { backgroundColor: '#1F5EAA', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { color: '#e2e8f0', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptySub: { color: '#8fa3bf', fontSize: 13, textAlign: 'center' },
  sessionCard: { backgroundColor: '#131929', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#253060', gap: 6 },
  sessionLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '700' },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  processingText: { color: '#00C4CC', fontSize: 12, fontWeight: '600' },
  doneText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  reviewText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  idleText: { color: '#8fa3bf', fontSize: 12 },
  chat: { flex: 1 },
  bubble: { borderRadius: 12, padding: 12, maxWidth: '85%' },
  bubbleUser: { backgroundColor: '#1a2240', alignSelf: 'flex-end' },
  bubbleAgent: { backgroundColor: '#131929', borderWidth: 1, borderColor: '#253060', alignSelf: 'flex-start' },
  bubbleRole: { color: '#8fa3bf', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  confirmRow: { padding: 12, paddingBottom: 0, gap: 6 },
  confirmBtn: { backgroundColor: '#15803d', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  confirmHint: { color: '#8fa3bf', fontSize: 12, textAlign: 'center' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#253060' },
  textInput: { flex: 1, backgroundColor: '#131929', borderWidth: 1, borderColor: '#253060', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, color: '#e2e8f0', fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: '#1F5EAA', borderRadius: 10, width: 44, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#253060' },
  sendIcon: { color: '#fff', fontSize: 18 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  micBtn: { backgroundColor: '#253060', borderRadius: 10, width: 44, justifyContent: 'center', alignItems: 'center' },
  micBtnRecording: { backgroundColor: '#c53030' },
  micIcon: { fontSize: 20 },
});
