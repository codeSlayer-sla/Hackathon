import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { initDatabase } from './src/db/database';
import LoginScreen from './src/screens/LoginScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import ObservationsScreen from './src/screens/ObservationsScreen';
import SyncScreen from './src/screens/SyncScreen';

type Tab = 'capture' | 'observations' | 'sync';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    initDatabase().then(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo}><Text style={styles.logoText}>PHILIPS</Text></View>
        <Text style={styles.splashSub}>Technician App</Text>
      </View>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen onLogin={(t, name) => { setToken(t); setTechnicianName(name); }} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>PHILIPS</Text></View>
        <Text style={styles.headerName}>{technicianName}</Text>
        <TouchableOpacity onPress={() => { setToken(null); setTechnicianName(''); }}>
          <Text style={styles.logout}>Salir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'capture' && (
          <CaptureScreen
            technicianName={technicianName}
            onSaved={() => setSavedCount((n) => n + 1)}
          />
        )}
        {activeTab === 'observations' && <ObservationsScreen />}
        {activeTab === 'sync' && <SyncScreen token={token} />}
      </View>

      <View style={styles.tabBar}>
        <TabBtn label="Capturar" icon="🎤" active={activeTab === 'capture'} onPress={() => setActiveTab('capture')} />
        <TabBtn label="Registros" icon="📋" active={activeTab === 'observations'} onPress={() => setActiveTab('observations')} badge={savedCount > 0 ? savedCount : undefined} />
        <TabBtn label="Sincronizar" icon="☁" active={activeTab === 'sync'} onPress={() => setActiveTab('sync')} />
      </View>
    </SafeAreaView>
  );
}

function TabBtn({ label, icon, active, onPress, badge }: {
  label: string; icon: string; active: boolean; onPress: () => void; badge?: number;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
      <View>
        <Text style={styles.tabIcon}>{icon}</Text>
        {badge != null && (
          <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0f1e' },
  splash: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center', gap: 12 },
  logo: { backgroundColor: '#1F5EAA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 2 },
  splashSub: { color: '#8fa3bf', fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#253060', gap: 10 },
  headerName: { flex: 1, color: '#8fa3bf', fontSize: 13 },
  logout: { color: '#4a5568', fontSize: 13 },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#253060', backgroundColor: '#131929' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabIcon: { fontSize: 20, textAlign: 'center' },
  tabLabel: { color: '#4a5568', fontSize: 11, marginTop: 3, fontWeight: '600' },
  tabLabelActive: { color: '#00C4CC' },
  tabIndicator: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: '#1F5EAA', borderRadius: 2 },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
