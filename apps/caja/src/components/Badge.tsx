import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

type Tone = "success" | "warning" | "danger" | "neutral";

const tones: Record<
  Tone,
  { bg: string; fg: string }
> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  neutral: { bg: colors.primarySoft, fg: colors.primary },
};

export default function Badge({
  text,
  tone,
}: {
  text: string;
  tone: Tone;
}) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});