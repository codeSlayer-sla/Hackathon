import { useState } from "react";
import MeshDemoView from "./mesh/MeshDemoView";
import CaptureView from "./installedBase/CaptureView";
import CustomersView from "./installedBase/CustomersView";
import AnalyticsView from "./installedBase/AnalyticsView";
import PhotosView from "./installedBase/PhotosView";
import QueryView from "./installedBase/QueryView";
import TechniciansView from "./installedBase/TechniciansView";
import LoginGate from "./auth/LoginGate";
import { colors, font } from "./theme";

type Tab = "capture" | "photos" | "customers" | "analytics" | "query" | "technicians" | "mesh";

const TABS: { id: Tab; label: string; needsAuth: boolean }[] = [
  { id: "capture", label: "Capturar visita", needsAuth: true },
  { id: "photos", label: "Fotos", needsAuth: true },
  { id: "customers", label: "Clientes", needsAuth: false },
  { id: "analytics", label: "Analytics", needsAuth: false },
  { id: "query", label: "Consultas", needsAuth: false },
  { id: "technicians", label: "Técnicos", needsAuth: false },
  { id: "mesh", label: "Mesh Demo", needsAuth: false },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [token, setToken] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.id === tab)!;
  const needsLogin = currentTab.needsAuth && !token;

  return (
    <div style={{ background: colors.bg, minHeight: "100vh", fontFamily: font }}>
      <header
        style={{
          background: colors.card,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "20px 24px 0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: colors.primary, letterSpacing: -0.3 }}>
              Customer Installed Base Intelligence
            </h1>
            <p style={{ color: colors.textMuted, margin: "6px 0 20px", maxWidth: 640, fontSize: 14, lineHeight: 1.5 }}>
              Reto Philips: convertir lo que un colaborador observa en un hospital en datos
              estructurados sobre la base instalada, con inferencia corriendo en el dispositivo
              (Enterprise AI Mesh + QVAC).
            </p>
          </div>
          {token && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: colors.textMuted,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Conectado como <strong style={{ color: colors.text }}>{technicianName}</strong>
              <button
                onClick={() => {
                  setToken(null);
                  setTechnicianName(null);
                }}
                style={{
                  background: "none",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  color: colors.textMuted,
                  fontFamily: font,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Salir
              </button>
            </div>
          )}
        </div>

        <nav
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            gap: 2,
            overflowX: "auto",
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${colors.accent}` : "2px solid transparent",
                background: "none",
                color: tab === t.id ? colors.primary : colors.textMuted,
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 14,
                fontFamily: font,
                whiteSpace: "nowrap",
                cursor: "pointer",
                transition: "color 150ms ease, border-color 150ms ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: 24,
          color: colors.text,
        }}
      >
        {needsLogin ? (
          <LoginGate
            onLogin={(t, name) => {
              setToken(t);
              setTechnicianName(name);
            }}
          />
        ) : (
          <>
            {tab === "capture" && <CaptureView token={token!} />}
            {tab === "photos" && <PhotosView token={token!} />}
            {tab === "customers" && <CustomersView />}
            {tab === "analytics" && <AnalyticsView />}
            {tab === "query" && <QueryView />}
            {tab === "technicians" && <TechniciansView />}
            {tab === "mesh" && <MeshDemoView />}
          </>
        )}
      </div>
    </div>
  );
}
