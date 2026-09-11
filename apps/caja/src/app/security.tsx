import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Screen from "@/components/Screen";
import { analyzeMessage, AnalysisResult } from "@/lib/security";
import { colors } from "@/theme";

const example = "Su cuenta será bloqueada. Ingrese al siguiente enlace para verificar sus datos.";

export default function SecurityScreen() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  function analyze() {
    setResult(analyzeMessage(text));
  }

  const tone =
    result?.riskLevel === "high"
      ? ("danger" as const)
      : result?.riskLevel === "medium"
        ? ("warning" as const)
        : ("success" as const);

  return (
    <Screen>
      <Text style={styles.description}>
        Pega un SMS, correo o mensaje sospechoso y analízalo con reglas locales
        deterministas. La decisión de seguridad nunca depende del modelo de IA.
      </Text>

      <Card>
        <Text style={styles.label}>Mensaje a analizar</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Pega aquí el mensaje…"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setText(example)}
          style={styles.example}
        >
          <Text style={styles.exampleText}>Usar mensaje de ejemplo</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!text.trim()}
          onPress={analyze}
          style={({ pressed }) => [
            styles.analyze,
            (!text.trim() || pressed) && styles.analyzeDisabled,
          ]}
        >
          <Text style={styles.analyzeText}>Analizar</Text>
        </Pressable>
      </Card>

      {result && (
        <Card>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>Resultado</Text>
            <Badge text={`Riesgo ${result.riskLevel}`} tone={tone} />
          </View>

          {result.redFlags.length > 0 ? (
            <View style={styles.flags}>
              <Text style={styles.flagsTitle}>
                {result.redFlags.length} señal(es) detectada(s)
              </Text>
              {result.redFlags.map((flag) => (
                <View key={flag} style={styles.flagRow}>
                  <Text style={styles.flagBullet}>•</Text>
                  <Text style={styles.flagText}>{flag}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noFlags}>Sin señales de fraude detectadas.</Text>
          )}

          <Text style={styles.actionTitle}>Acción recomendada</Text>
          <Text style={styles.action}>{result.recommendedAction}</Text>
        </Card>
      )}

      <Card style={styles.noteCard}>
        <Text style={styles.noteText}>
          🛡️ Recuerda: ninguna entidad bancaria legítima te pedirá por mensaje
          tu contraseña, PIN o códigos de verificación.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    minHeight: 120,
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
  example: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  exampleText: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  analyze: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  analyzeDisabled: {
    opacity: 0.5,
  },
  analyzeText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  flags: {
    marginBottom: 12,
  },
  flagsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 6,
  },
  flagRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  flagBullet: {
    color: colors.danger,
    fontWeight: "800",
    marginRight: 6,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  noFlags: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 6,
  },
  action: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  noteCard: {
    backgroundColor: colors.successSoft,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
});