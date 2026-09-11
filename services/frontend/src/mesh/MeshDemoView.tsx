import { useEffect, useState } from "react";
import type { AskResponse, PeerCapability } from "@shared/types";
import { ask, listPeers } from "../api/router";
import StatTile, { type StatTone } from "../components/StatTile";
import { badge, button, card, colors, font, input } from "../theme";

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

  const onlineCount = peers.filter((p) => p.available).length;
  const totalCount = peers.length;
  const ratio = totalCount > 0 ? onlineCount / totalCount : 0;
  const tone: StatTone = totalCount === 0 ? "neutral" : onlineCount === 0 ? "danger" : onlineCount === totalCount ? "success" : "warning";

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 20 }}>
      <p style={{ color: colors.textMuted, margin: 0, fontSize: 14 }}>
        Local RAG {"->"} AI Router {"->"} Local/P2P QVAC peer {"->"} respuesta + costo.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatTile
          label="Nodos en línea"
          value={`${onlineCount}/${totalCount}`}
          sublabel={totalCount === 0 ? "Sin peers registrados" : "peers disponibles ahora"}
          tone={tone}
          ratio={totalCount > 0 ? ratio : undefined}
          live
          announce={`${onlineCount} de ${totalCount} nodos en línea`}
        />
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Peers</h3>
        {peers.length === 0 && <p style={{ color: colors.textMuted }}>Sin peers registrados todavia.</p>}
        {peers.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Node", "Rol", "Tier", "Modelo", "Estado", "$/1K tok"].map((h) => (
                    <th
                      key={h}
                      align="left"
                      style={{
                        padding: "6px 10px",
                        borderBottom: `1px solid ${colors.border}`,
                        color: colors.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.node_id}>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}`, fontWeight: 600 }}>
                      {p.node_id}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}` }}>{p.role}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}` }}>{p.model_tier}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}` }}>{p.model_name}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}` }}>
                      <span style={badge(p.available ? colors.successBg : colors.dangerBg, p.available ? colors.success : colors.danger)}>
                        {p.available ? "En línea" : "Sin conexión"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${colors.border}` }}>
                      {p.price_per_1k_tokens}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0, fontSize: 16 }}>Chat</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...input, flex: 1 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Pregunta algo sobre la infraestructura..."
          />
          <button style={button} onClick={handleAsk} disabled={loading}>
            {loading ? "..." : "Preguntar"}
          </button>
        </div>

        {history
          .slice()
          .reverse()
          .map((entry, i) => (
            <div
              key={i}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}
            >
              <p style={{ margin: "0 0 6px" }}>
                <strong>Q:</strong> {entry.query}
              </p>
              {entry.error && <p style={{ color: colors.danger, fontSize: 13 }}>Error: {entry.error}</p>}
              {entry.response && (
                <>
                  <p style={{ margin: "0 0 6px" }}>
                    <strong>A:</strong> {entry.response.answer}
                  </p>
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 4px" }}>
                    plan: {entry.response.plan.execution_mode} / {entry.response.plan.model_tier} @{" "}
                    {entry.response.plan.target_node_id} ({entry.response.plan.reason})
                  </p>
                  <p style={{ fontSize: 12, color: colors.textMuted, margin: 0 }}>
                    uso: {entry.response.usage.tokens_in}+{entry.response.usage.tokens_out} tokens,{" "}
                    {entry.response.usage.duration_ms.toFixed(0)} ms, costo {entry.response.usage.cost} (
                    {entry.response.usage.settlement_status})
                  </p>
                  {entry.response.rag.sources.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", color: colors.textMuted, fontSize: 13 }}>Fuentes RAG</summary>
                      <ul style={{ marginTop: 6 }}>
                        {entry.response.rag.sources.map((s) => (
                          <li key={s.doc_id} style={{ fontSize: 13 }}>
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
      </div>
    </div>
  );
}
