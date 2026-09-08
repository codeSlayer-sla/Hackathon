import { useState } from "react";
import type { NaturalLanguageQueryResponse } from "@shared/types";
import { queryDataset } from "../api/installedBase";

export default function QueryView() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<NaturalLanguageQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await queryDataset(question));
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        Pregunta en lenguaje natural sobre el dataset, ej: "clientes en Panama con equipos MR".
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: 8 }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="Ej: clientes en Panama con equipos MR"
        />
        <button onClick={handleAsk} disabled={loading}>
          {loading ? "..." : "Preguntar"}
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <div>
          <p style={{ fontSize: 12, color: "#666" }}>
            Filtro interpretado: <code>{JSON.stringify(result.interpreted_filter)}</code>
          </p>
          <p>{result.results.length} resultado(s)</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Cliente</th>
                <th align="left">Pais</th>
                <th align="left">Modalidad</th>
                <th align="left">Cant.</th>
                <th align="left">Marca</th>
                <th align="left">Edad aprox.</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((o, i) => (
                <tr key={i}>
                  <td>{o.customer}</td>
                  <td>{o.country ?? "-"}</td>
                  <td>{o.modality}</td>
                  <td>{o.quantity ?? "-"}</td>
                  <td>{o.brand ?? "-"}</td>
                  <td>{o.approx_age_years ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
