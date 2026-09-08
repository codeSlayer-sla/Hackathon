import { useEffect, useState } from "react";
import type { AnalyticsSummary } from "@shared/types";
import { getAnalytics } from "../api/installedBase";

export default function AnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  }, []);

  if (!analytics) return <p>Cargando analytics...</p>;

  return (
    <div>
      <p>Total de observaciones: {analytics.total_observations}</p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h4>Por modalidad</h4>
          <ul>
            {Object.entries(analytics.by_modality).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Por pais</h4>
          <ul>
            {Object.entries(analytics.by_country).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Por status</h4>
          <ul>
            {Object.entries(analytics.by_status).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p>Edad promedio estimada: {analytics.average_age_years ?? "N/D"} anios</p>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h4>Clientes con equipo antiguo (8+ anios)</h4>
          {analytics.aging_customers.length === 0 ? (
            <p>Ninguno</p>
          ) : (
            <ul>
              {analytics.aging_customers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Clientes con informacion incompleta</h4>
          {analytics.incomplete_customers.length === 0 ? (
            <p>Ninguno</p>
          ) : (
            <ul>
              {analytics.incomplete_customers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <h4>Sin verificar recientemente (90+ dias)</h4>
          {analytics.stale_customers.length === 0 ? (
            <p>Ninguno</p>
          ) : (
            <ul>
              {analytics.stale_customers.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Oportunidades de renovacion</h4>
          {analytics.refresh_opportunities.length === 0 ? (
            <p>Ninguna</p>
          ) : (
            <ul>
              {analytics.refresh_opportunities.map((o) => (
                <li key={o.customer}>
                  <strong>{o.customer}</strong>: {o.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
