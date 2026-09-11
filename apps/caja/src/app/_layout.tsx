import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text } from "react-native";
import { colors } from "@/theme";

function tabIcon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={[styles.icon, { color }]}>{emoji}</Text>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "700" },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: styles.tabBar,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Inicio", tabBarLabel: "Inicio", tabBarIcon: tabIcon("🏠") }}
        />
        <Tabs.Screen
          name="assistant"
          options={{ title: "Asistente", tabBarLabel: "Asistente", tabBarIcon: tabIcon("💬") }}
        />
        <Tabs.Screen
          name="security"
          options={{ title: "Seguridad", tabBarLabel: "Seguridad", tabBarIcon: tabIcon("🛡️") }}
        />
        <Tabs.Screen
          name="simulator"
          options={{ title: "Simulador", tabBarLabel: "Simulador", tabBarIcon: tabIcon("🧮") }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 18,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: "#e3e8f0",
  },
});