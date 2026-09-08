import { useState } from "react";
import MeshDemoView from "./mesh/MeshDemoView";
import CaptureView from "./installedBase/CaptureView";
import CustomersView from "./installedBase/CustomersView";
import AnalyticsView from "./installedBase/AnalyticsView";

type Tab = "capture" | "customers" | "analytics" | "mesh";

const TABS: { id: Tab; label: string }[] = [
  { id: "capture", label: "Capturar visita" },
  { id: "customers", label: "Clientes" },
  { id: "analytics", label: "Analytics" },
  { id: "mesh", label: "Mesh Demo" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("capture");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Customer Installed Base Intelligence</h1>
      <p style={{ color: "#666" }}>
        Reto Philips: convertir lo que un colaborador observa en un hospital en datos
        estructurados sobre la base instalada, con inferencia corriendo en el dispositivo
        (Enterprise AI Mesh + QVAC).
      </p>

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

      {tab === "capture" && <CaptureView />}
      {tab === "customers" && <CustomersView />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "mesh" && <MeshDemoView />}
    </div>
  );
}
