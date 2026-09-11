import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { localAiService } from "@/lib/localAiService";
import { colors } from "@/theme";

const actions = [
  {
    href: "/assistant" as const,
    emoji: "💬",
    title: "Asistente financiero",
    subtitle: "Resuelve tus dudas en español",
  },
  {
    href: "/security" as const,
    emoji: "🛡️",
    title: "Analizar mensaje",
    subtitle: "Detecta phishing y fraude",
  },
  {
    href: "/simulator" as const,
    emoji: "🧮",
    title: "Simulador de ahorro",
    subtitle: "Proyecta tu ahorro con interés",
  },
];

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>🏦 CajaAI</Text>
        <Text style={styles.tagline}>Inteligencia financiera local</Text>
      </View>

      <Card>
        <View style={styles.statusRow}>
          <Text style={styles.statusEmoji}>🔒</Text>
          <View style={styles.statusBody}>
            <Text style={styles.statusTitle}>LOCAL AI</Text>
            <Text style={styles.statusSubtitle}>{localAiService.providerLabel}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <Badge text="QVAC" tone="neutral" />
          <Badge text="Qwen3 600M" tone="neutral" />
          <Badge text="Offline" tone="success" />
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Servicios</Text>
      {actions.map((action) => (
        <Link key={action.href} href={action.href} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionEmoji}>{action.emoji}</Text>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </Link>
      ))}

      <Card style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>🔐 Privacidad</Text>
        <Text style={styles.privacyText}>
          Tu información permanece en tu dispositivo. CajaAI funciona sin
          enviar tus datos a la nube.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.primary,
  },
  tagline: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  statusBody: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  actionPressed: {
    backgroundColor: colors.primarySoft,
  },
  actionEmoji: {
    fontSize: 26,
    marginRight: 14,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 26,
    color: colors.textMuted,
  },
  privacyCard: {
    backgroundColor: colors.primarySoft,
    marginTop: 8,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 6,
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});