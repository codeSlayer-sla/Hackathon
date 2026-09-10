import { useState } from "react";
import MeshDemoView from "./mesh/MeshDemoView";
import CaptureView from "./installedBase/CaptureView";
import CustomersView from "./installedBase/CustomersView";
import AnalyticsView from "./installedBase/AnalyticsView";
import PhotosView from "./installedBase/PhotosView";
import QueryView from "./installedBase/QueryView";
import TechniciansView from "./installedBase/TechniciansView";
import LoginGate from "./auth/LoginGate";
import { colors } from "./theme";

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
    <div style={{ background: colors.bg, minHeight: "100vh" }}>
      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 1000,
          margin: "0 auto",
          padding: 24,
          color: colors.text,
        }}
      >
        <header style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 22, color: colors.primary }}>
              Customer Installed Base Intelligence
            </h1>
            {token && (
              <div style={{ fontSize: 13, color: colors.textMuted, whiteSpace: "nowrap" }}>
                Conectado como <strong style={{ color: colors.text }}>{technicianName}</strong>{" "}
                <button
                  onClick={() => {
                    setToken(null);
                    setTechnicianName(null);
                  }}
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    color: colors.textMuted,
                  }}
                >
                  Salir
                </button>
              </div>
            )}
          </div>
          <p style={{ color: colors.textMuted, marginTop: 6, maxWidth: 640 }}>
            Reto Philips: convertir lo que un colaborador observa en un hospital en datos
            estructurados sobre la base instalada, con inferencia corriendo en el dispositivo
            (Enterprise AI Mesh + QVAC).
          </p>
        </header>

        <nav
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: `1px solid ${colors.border}`,
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
                borderBottom: tab === t.id ? `2px solid ${colors.primary}` : "2px solid transparent",
                background: "none",
                color: tab === t.id ? colors.primary : colors.textMuted,
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

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
