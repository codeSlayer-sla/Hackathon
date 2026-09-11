import { useEffect, useState } from "react";
import type { AnalyticsSummary, TechnicianSummary } from "@shared/types";
import { getAnalytics, listTechnicians } from "../api/installedBase";
import { badge, card, colors, font } from "../theme";
import StatTile from "../components/StatTile";
import { DelegateIcon } from "../components/icons";

function relativeLastSeen(iso: string | undefined): { label: string; tone: "online" | "recent" | "stale" | "never" } {
  if (!iso) return { label: "Nunca conectado", tone: "never" };
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = ms / 60_000;
  if (minutes < 15) return { label: "Activo hace poco", tone: "online" };
  if (minutes < 60) return { label: `Hace ${Math.round(minutes)} min`, tone: "recent" };
  const hours = minutes / 60;
  if (hours < 24) return { label: `Hace ${Math.round(hours)} h`, tone: "recent" };
  const days = hours / 24;
  return { label: `Hace ${Math.round(days)} d`, tone: "stale" };
}

const TONE_STYLE: Record<string, [string, string]> = {
  online: [colors.successBg, colors.success],
  recent: [colors.warningBg, colors.warning],
  stale: [colors.border, colors.textMuted],
  never: [colors.border, colors.textMuted],
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Read-only view onto the mesh's real client roster -- who's out there, who's
 * online right now, and how much inference they've offloaded to this node.
 * Technicians are provisioned another way (not from this dashboard); this
 * screen is strictly for observing the mesh, never for administering it. */
export default function TechniciansView() {
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  function refresh() {
    listTechnicians()
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
    // Powers the technician x pais matrix below -- same /analytics the
    // Analytics tab already uses, no dedicated endpoint needed.
    getAnalytics()
      .then(setAnalytics)
      .catch(() => setAnalytics(null));
  }

  useEffect(() => {
    refresh();
    // Reflects last_seen_at/observation_count/remote_extraction_count as
    // they change (a phone syncing, logging in, offloading a request to
    // this node, etc.) without a manual refresh -- this is the "which
    // technician apps are actually talking to us" view, so it should feel
    // live.
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  const totalDelegated = technicians.reduce((sum, t) => sum + (t.remote_extraction_count ?? 0), 0);
  const onlineNow = technicians.filter((t) => relativeLastSeen(t.last_seen_at).tone === "online").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: font }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatTile
          label="Técnicos activos ahora"
          value={`${onlineNow}/${technicians.length}`}
          sublabel="vistos en los últimos 15 min"
          tone={onlineNow > 0 ? "success" : "neutral"}
          live
          announce={`${onlineNow} de ${technicians.length} técnicos activos en los últimos 15 minutos`}
        />
        <StatTile
          label="Delegado al nodo principal"
          value={totalDelegated}
          sublabel={totalDelegated === 1 ? "inferencia total" : "inferencias totales"}
          tone={totalDelegated > 0 ? "success" : "neutral"}
          live
          announce={`${totalDelegated} inferencias delegadas al nodo principal en total`}
        />
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Técnicos ({technicians.length})</h3>
          <span style={{ fontSize: 12, color: colors.textMuted }}>Actualiza cada 15s</span>
        </div>
        <p style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 }}>
          Quiénes están conectando a este nodo y cuánta inferencia le delegaron -- solo lectura.
        </p>
        {technicians.length === 0 ? (
          <p style={{ color: colors.textMuted }}>Sin técnicos registrados todavía.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {technicians.map((t) => {
              const seen = relativeLastSeen(t.last_seen_at);
              const [bg, fg] = TONE_STYLE[seen.tone];
              const delegatedCount = t.remote_extraction_count ?? 0;
              return (
                <div
                  key={t.technician_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 4px",
                    borderTop: `1px solid ${colors.border}`,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      aria-hidden="true"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: colors.primaryLight,
                        color: colors.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {initials(t.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: colors.textMuted }}>{t.technician_id}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={badge(colors.border, colors.textMuted)}>
                      {t.observation_count} registro{t.observation_count === 1 ? "" : "s"}
                    </span>
                    {delegatedCount > 0 && (
                      <span
                        title={`${delegatedCount} inferencia${delegatedCount === 1 ? "" : "s"} delegada${
                          delegatedCount === 1 ? "" : "s"
                        } al nodo principal`}
                        style={{
                          ...badge(colors.successBg, colors.success),
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <DelegateIcon color={colors.success} />
                        {delegatedCount}x nodo principal
                      </span>
                    )}
                    <span style={badge(bg, fg)}>{seen.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {analytics?.by_technician_country && Object.keys(analytics.by_technician_country).length > 0 && (
        <div style={card}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Registros por técnico y país</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${colors.border}` }}>
                    Técnico
                  </th>
                  {Object.keys(analytics?.by_country ?? {}).map((country) => (
                    <th
                      key={country}
                      style={{ textAlign: "right", padding: "6px 10px", borderBottom: `1px solid ${colors.border}` }}
                    >
                      {country}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(analytics.by_technician_country).map(([tech, byCountry]) => (
                  <tr key={tech}>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${colors.border}` }}>{tech}</td>
                    {Object.keys(analytics?.by_country ?? {}).map((country) => (
                      <td
                        key={country}
                        style={{ textAlign: "right", padding: "6px 10px", borderBottom: `1px solid ${colors.border}` }}
                      >
                        {byCountry[country] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
