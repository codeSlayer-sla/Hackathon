import React, { useEffect, useState } from "react";
import { Platform, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  completion,
  downloadAsset,
  LLAMA_3_2_1B_INST_Q4_0,
  loadModel,
  type ModelProgressUpdate,
  unloadModel,
  VERBOSITY,
} from "@qvac/sdk";

/**
 * QVAC lifecycle smoke test (per docs.qvac.tether.io/tutorials/expo) --
 * proves on-device inference works on a real phone before building the
 * actual capture flow (text/voice/photo observation -> extraction ->
 * sync to services/installed-base). Requires a physical device; QVAC
 * does not run on emulators (llama.cpp limitation).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <QvacSmokeTest />
    </SafeAreaProvider>
  );
}

function QvacSmokeTest() {
  const [status, setStatus] = useState("Iniciando...");
  const [output, setOutput] = useState("");
  const [progressPct, setProgressPct] = useState<number | null>(null);

  useEffect(() => {
    let modelId: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        setStatus("Descargando modelo...");
        await downloadAsset({
          assetSrc: LLAMA_3_2_1B_INST_Q4_0,
          onProgress: (progress: ModelProgressUpdate) => {
            if (!cancelled) setProgressPct(Math.round(progress.percentage));
          },
        });
        if (cancelled) return;

        setProgressPct(null);
        setStatus("Cargando modelo...");
        modelId = await loadModel({
          modelSrc: LLAMA_3_2_1B_INST_Q4_0,
          modelType: "llm",
          modelConfig: { device: "gpu", ctx_size: 2048, verbosity: VERBOSITY.ERROR },
          onProgress: (progress: ModelProgressUpdate) => {
            if (!cancelled) setProgressPct(Math.round(progress.percentage));
          },
        });
        if (cancelled) {
          await unloadModel({ modelId, clearStorage: false });
          return;
        }

        setProgressPct(null);
        setStatus("Corriendo inferencia local...");
        const result = completion({
          modelId,
          history: [{ role: "user", content: "Di hola en una frase corta." }],
          stream: true,
        });
        let acc = "";
        for await (const token of result.tokenStream) {
          acc += token;
          if (!cancelled) setOutput(acc);
        }
        if (!cancelled) setStatus("Listo");
      } catch (e: any) {
        if (!cancelled) setStatus(`Error: ${e?.message ?? String(e)}`);
      }
    })();

    return () => {
      cancelled = true;
      if (modelId) {
        void unloadModel({ modelId, clearStorage: false }).catch(() => {});
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.h1}>QVAC Technician App</Text>
        <Text testID="status" style={styles.status}>
          {status}
          {progressPct != null ? ` (${progressPct}%)` : ""}
        </Text>
        <Text testID="output" style={styles.output}>
          {output}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0B0F", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  container: { flex: 1, padding: 16, gap: 12 },
  h1: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#A7A7B3" },
  output: { color: "white", fontSize: 16, lineHeight: 22 },
});
