import { useEffect, useState } from "react";
import type { TechnicianSummary } from "@shared/types";
import { listTechnicians, registerTechnician } from "../api/installedBase";
import { badge, button, card, colors, input } from "../theme";

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

export default function TechniciansView() {
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    listTechnicians()
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }

  useEffect(() => {
    refresh();
    // Reflects last_seen_at as it changes (a phone syncing, logging in,
    // etc.) without a manual refresh -- this is the "which technician apps
    // are actually talking to us" view, so it should feel live.
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  async function handleRegister() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      setError("El PIN debe tener entre 4 y 8 dígitos.");
      return;
    }
    setSubmitting(true);
    try {
      await registerTechnician(name.trim(), pin);
      setName("");
      setPin("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Registrar técnico</h3>
        <p style={{ color: colors.textMuted, fontSize: 13, marginTop: -8 }}>
          El técnico podrá usar este PIN para iniciar sesión en la app móvil de inmediato. Su
          teléfono descarga el PIN para uso offline automáticamente la próxima vez que esté
          online (después de su propio login, o cuando la pantalla de Sincronizar detecte
          conexión) -- no hace falta ningún paso adicional.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input
            style={{ ...input, flex: 2, minWidth: 180 }}
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={{ ...input, flex: 1, minWidth: 100 }}
            placeholder="PIN (4-8 dígitos)"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            maxLength={8}
          />
          <button style={button} onClick={handleRegister} disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar"}
          </button>
        </div>
        {error && <p style={{ color: colors.danger, fontSize: 13, marginBottom: 0 }}>{error}</p>}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Técnicos ({technicians.length})</h3>
        {technicians.length === 0 ? (
          <p style={{ color: colors.textMuted }}>Sin técnicos registrados todavía.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {technicians.map((t) => {
              const seen = relativeLastSeen(t.last_seen_at);
              const [bg, fg] = TONE_STYLE[seen.tone];
              return (
                <div
                  key={t.technician_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 4px",
                    borderTop: `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>{t.technician_id}</div>
                  </div>
                  <span style={badge(bg, fg)}>{seen.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
