import { useEffect, useState } from "react";
import type { AskResponse, PeerCapability } from "@shared/types";
import { ask, listPeers } from "../api/router";

interface ChatEntry {
  query: string;
  response?: AskResponse;
  error?: string;
}

export default function MeshDemoView() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [peers, setPeers] = useState<PeerCapability[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refresh = () => listPeers().then(setPeers).catch(() => setPeers([]));
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleAsk() {
    if (!query.trim()) return;
    const q = query;
    setQuery("");
    setLoading(true);
    setHistory((h) => [...h, { query: q }]);
    try {
      const response = await ask({ query: q });
      setHistory((h) => h.map((e) => (e.query === q && !e.response ? { ...e, response } : e)));
    } catch (err) {
      setHistory((h) =>
        h.map((e) => (e.query === q && !e.response ? { ...e, error: String(err) } : e))
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        Local RAG {"->"} AI Router {"->"} Local/P2P QVAC peer {"->"} respuesta + costo.
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2>Peers</h2>
        {peers.length === 0 && <p>Sin peers registrados todavia.</p>}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Node</th>
              <th align="left">Rol</th>
              <th align="left">Tier</th>
              <th align="left">Modelo</th>
              <th align="left">Disponible</th>
              <th align="left">$/1K tok</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p) => (
              <tr key={p.node_id}>
                <td>{p.node_id}</td>
                <td>{p.role}</td>
                <td>{p.model_tier}</td>
                <td>{p.model_name}</td>
                <td>{p.available ? "si" : "no"}</td>
                <td>{p.price_per_1k_tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Chat</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: 8 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Pregunta algo sobre la infraestructura..."
          />
          <button onClick={handleAsk} disabled={loading}>
            {loading ? "..." : "Preguntar"}
          </button>
        </div>

        {history
          .slice()
          .reverse()
          .map((entry, i) => (
            <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p>
                <strong>Q:</strong> {entry.query}
              </p>
              {entry.error && <p style={{ color: "crimson" }}>Error: {entry.error}</p>}
              {entry.response && (
                <>
                  <p>
                    <strong>A:</strong> {entry.response.answer}
                  </p>
                  <p style={{ fontSize: 12, color: "#666" }}>
                    plan: {entry.response.plan.execution_mode} / {entry.response.plan.model_tier} @{" "}
                    {entry.response.plan.target_node_id} ({entry.response.plan.reason})
                  </p>
                  <p style={{ fontSize: 12, color: "#666" }}>
                    uso: {entry.response.usage.tokens_in}+{entry.response.usage.tokens_out} tokens,{" "}
                    {entry.response.usage.duration_ms.toFixed(0)} ms, costo {entry.response.usage.cost} (
                    {entry.response.usage.settlement_status})
                  </p>
                  {entry.response.rag.sources.length > 0 && (
                    <details>
                      <summary>Fuentes RAG</summary>
                      <ul>
                        {entry.response.rag.sources.map((s) => (
                          <li key={s.doc_id}>
                            <strong>{s.title}</strong>: {s.snippet}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
      </section>
    </div>
  );
}
