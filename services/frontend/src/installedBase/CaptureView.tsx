import { useState } from "react";
import type { CaptureTurnResponse } from "@shared/types";
import { captureTurn } from "../api/installedBase";

interface TurnEntry {
  text: string;
  response?: CaptureTurnResponse;
  error?: string;
}

export default function CaptureView() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<TurnEntry[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!text.trim()) return;
    const sent = text;
    setText("");
    setLoading(true);
    setHistory((h) => [...h, { text: sent }]);
    try {
      const response = await captureTurn({ session_id: sessionId, text: sent });
      setSessionId(response.done ? undefined : response.session_id);
      setHistory((h) => h.map((e) => (e.text === sent && !e.response ? { ...e, response } : e)));
    } catch (err) {
      setHistory((h) => h.map((e) => (e.text === sent && !e.response ? { ...e, error: String(err) } : e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        Describi lo que viste en la visita, como se lo contarias a un colega. El asistente
        pregunta lo que falte y guarda la observacion cuando este completa.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ej: Estoy en Hospital DemoCare Pacific, en Panama. Tienen dos resonadores y un tomografo."
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? "..." : "Enviar"}
        </button>
      </div>

      {history
        .slice()
        .reverse()
        .map((entry, i) => (
          <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <p>
              <strong>Vos:</strong> {entry.text}
            </p>
            {entry.error && <p style={{ color: "crimson" }}>Error: {entry.error}</p>}
            {entry.response && (
              <>
                <p>
                  <strong>Asistente:</strong> {entry.response.agent_message}
                </p>
                {entry.response.saved_observations.length > 0 && (
                  <ul>
                    {entry.response.saved_observations.map((o, idx) => (
                      <li key={idx}>
                        {o.quantity ?? "?"}x {o.modality} - {o.customer} ({o.status}, confianza{" "}
                        {o.confidence})
                        {o.possible_duplicate_of.length > 0 && (
                          <span style={{ color: "#a15c00" }}>
                            {" "}
                            - posible duplicado de #{o.possible_duplicate_of.join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
    </div>
  );
}
