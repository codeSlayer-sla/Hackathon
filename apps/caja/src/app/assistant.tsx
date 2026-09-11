import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Screen from "@/components/Screen";
import { ChatMessage } from "@/lib/localAi";
import { localAiService } from "@/lib/localAiService";
import { colors } from "@/theme";

const quickPrompts = [
  "¿Qué es una cuenta de ahorro?",
  "¿Cómo puedo empezar a ahorrar?",
  "¿Qué es una tasa de interés?",
  "¿Cuál es la diferencia entre ahorro y corriente?",
];

const welcomeMessage: ChatMessage = {
  role: "assistant",
  text:
    "Hola 👋 Soy tu asistente financiero local.\n\n" +
    "Puedo ayudarte con preguntas sobre ahorro, finanzas personales y seguridad bancaria. " +
    "Todas las respuestas se generan en tu dispositivo con Qwen3 600M, sin conexión a internet.",
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    const prompt = text.trim();
    if (!prompt || loading) {
      return;
    }
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      const reply = await localAiService.generateBankingResponse(prompt);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } finally {
      setLoading(false);
    }
  }

  function clearConversation() {
    localAiService.clearHistory();
    setMessages([welcomeMessage]);
    setInput("");
  }

  return (
    <Screen scroll={false}>
      <View style={styles.quickRow}>
        {quickPrompts.map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            disabled={loading}
            onPress={() => send(prompt)}
            style={({ pressed }) => [
              styles.quick,
              pressed && styles.quickPressed,
            ]}
          >
            <Text style={styles.quickText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <FlatList
          data={messages}
          keyExtractor={(_item, index) => String(index)}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={
                  item.role === "user" ? styles.userText : styles.assistantText
                }
              >
                {item.text}
              </Text>
            </View>
          )}
        />

        {loading && <Text style={styles.loading}>Pensando…</Text>}

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            placeholder="Escribe tu pregunta…"
            placeholderTextColor={colors.textMuted}
            editable={!loading}
            multiline
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            disabled={loading || !input.trim()}
            onPress={() => send(input)}
            style={({ pressed }) => [
              styles.send,
              (pressed || loading || !input.trim()) && styles.sendDisabled,
            ]}
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={clearConversation}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Limpiar conversación</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  quick: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickPressed: {
    opacity: 0.7,
  },
  quickText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  chat: {
    flex: 1,
    marginBottom: 8,
  },
  chatContent: {
    paddingVertical: 4,
    gap: 8,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: "88%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 21,
  },
  assistantText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  loading: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    width: 48,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: "#ffffff",
    fontSize: 20,
  },
  clear: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});