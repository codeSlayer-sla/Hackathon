import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initDatabase } from './src/db/database';
import { getServerUrl } from './src/config/serverConfig';
import { preloadLLM } from './src/qvac/models';
import LoginScreen from './src/screens/LoginScreen';
import ServerSetupScreen from './src/screens/ServerSetupScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import ObservationsScreen from './src/screens/ObservationsScreen';
import SyncScreen from './src/screens/SyncScreen';

type Tab = 'capture' | 'observations' | 'sync';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [showServerSetup, setShowServerSetup] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('capture');
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    initDatabase().then(async () => {
      setDbReady(true);
      const url = await getServerUrl();
      setServerUrl(url);
      if (!url) setShowServerSetup(true);
    });
  }, []);

  useEffect(() => {
    // Temporarily moved from boot to after login, to isolate whether the
    // app closing before the login screen even renders is caused by
    // preloading this early. If it still crashes here, the preload timing
    // wasn't the cause; if it stops crashing, it was.
    if (token) preloadLLM();
  }, [token]);

  if (!dbReady) {
    return (
      <View style={styles.splash}>
        <View style={styles.logo}><Text style={styles.logoText}>PHILIPS</Text></View>
        <Text style={styles.splashSub}>Technician App</Text>
      </View>
    );
  }

  if (showServerSetup) {
    return (
      <>
        <StatusBar style="light" />
        <ServerSetupScreen
          initialUrl={serverUrl}
          allowSkip={!!serverUrl}
          onDone={async () => {
            setServerUrl(await getServerUrl());
            setShowServerSetup(false);
          }}
        />
      </>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          onLogin={(t, name) => { setToken(t); setTechnicianName(name); }}
          onEditServer={() => setShowServerSetup(true)}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>PHILIPS</Text></View>
        <Text style={styles.headerName}>{technicianName}</Text>
        <TouchableOpacity onPress={() => setShowServerSetup(true)}>
          <Ionicons name="settings-outline" size={18} color="#4a5568" />
        </TouchableOpacity>
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
        <TabBtn label="Capturar" icon="mic-outline" iconActive="mic" active={activeTab === 'capture'} onPress={() => setActiveTab('capture')} />
        <TabBtn label="Registros" icon="document-text-outline" iconActive="document-text" active={activeTab === 'observations'} onPress={() => setActiveTab('observations')} badge={savedCount > 0 ? savedCount : undefined} />
        <TabBtn label="Sincronizar" icon="cloud-outline" iconActive="cloud" active={activeTab === 'sync'} onPress={() => setActiveTab('sync')} />
      </View>
    </SafeAreaView>
  );
}

function TabBtn({ label, icon, iconActive, active, onPress, badge }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress}>
      <View>
        <Ionicons name={active ? iconActive : icon} size={22} color={active ? '#00C4CC' : '#4a5568'} />
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
  tabLabel: { color: '#4a5568', fontSize: 11, marginTop: 3, fontWeight: '600' },
  tabLabelActive: { color: '#00C4CC' },
  tabIndicator: { position: 'absolute', top: 0, left: '20%', right: '20%', height: 2, backgroundColor: '#1F5EAA', borderRadius: 2 },
  badge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
