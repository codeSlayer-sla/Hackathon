import { useState } from "react";
import MeshDemoView from "./mesh/MeshDemoView";
import CaptureView from "./installedBase/CaptureView";
import CustomersView from "./installedBase/CustomersView";
import AnalyticsView from "./installedBase/AnalyticsView";
import PhotosView from "./installedBase/PhotosView";
import QueryView from "./installedBase/QueryView";
import LoginGate from "./auth/LoginGate";

type Tab = "capture" | "photos" | "customers" | "analytics" | "query" | "mesh";

const TABS: { id: Tab; label: string; needsAuth: boolean }[] = [
  { id: "capture", label: "Capturar visita", needsAuth: true },
  { id: "photos", label: "Fotos", needsAuth: true },
  { id: "customers", label: "Clientes", needsAuth: false },
  { id: "analytics", label: "Analytics", needsAuth: false },
  { id: "query", label: "Consultas", needsAuth: false },
  { id: "mesh", label: "Mesh Demo", needsAuth: false },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");
  const [token, setToken] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.id === tab)!;
  const needsLogin = currentTab.needsAuth && !token;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Customer Installed Base Intelligence</h1>
      <p style={{ color: "#666" }}>
        Reto Philips: convertir lo que un colaborador observa en un hospital en datos
        estructurados sobre la base instalada, con inferencia corriendo en el dispositivo
        (Enterprise AI Mesh + QVAC).
      </p>

      {token && (
        <p style={{ fontSize: 12, color: "#666" }}>
          Conectado como <strong>{technicianName}</strong>{" "}
          <button
            onClick={() => {
              setToken(null);
              setTechnicianName(null);
            }}
          >
            Salir
          </button>
        </p>
      )}

      <nav style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #ddd" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #0B4F6C" : "2px solid transparent",
              background: "none",
              fontWeight: tab === t.id ? "bold" : "normal",
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
          {tab === "mesh" && <MeshDemoView />}
        </>
      )}
    </div>
  );
}
