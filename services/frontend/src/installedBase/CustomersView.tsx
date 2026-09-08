import { useEffect, useState } from "react";
import type { CustomerSummary, EquipmentObservation } from "@shared/types";
import { getCustomer, listCustomers } from "../api/installedBase";

export default function CustomersView() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<EquipmentObservation[]>([]);

  useEffect(() => {
    listCustomers()
      .then(setCustomers)
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail([]);
      return;
    }
    getCustomer(selected)
      .then(setDetail)
      .catch(() => setDetail([]));
  }, [selected]);

  return (
    <div>
      {customers.length === 0 && <p>Sin clientes todavia.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            <th align="left">Cliente</th>
            <th align="left">Pais</th>
            <th align="left">Equipos</th>
            <th align="left">Modalidades</th>
            <th align="left">Info incompleta</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.customer}
              onClick={() => setSelected(c.customer)}
              style={{ cursor: "pointer", background: selected === c.customer ? "#eef6f9" : undefined }}
            >
              <td>{c.customer}</td>
              <td>{c.country}</td>
              <td>{c.equipment_count}</td>
              <td>
                {Object.entries(c.modalities)
                  .map(([m, q]) => `${m}=${q}`)
                  .join(", ")}
              </td>
              <td>{c.has_incomplete_info ? "si" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div>
          <h3>{selected} - detalle</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Modalidad</th>
                <th align="left">Cant.</th>
                <th align="left">Marca</th>
                <th align="left">Modelo</th>
                <th align="left">Edad aprox.</th>
                <th align="left">Confianza</th>
                <th align="left">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.map((o) => (
                <tr key={o.id}>
                  <td>{o.modality}</td>
                  <td>{o.quantity}</td>
                  <td>{o.brand ?? "Desconocido"}</td>
                  <td>{o.model ?? "-"}</td>
                  <td>{o.approx_age_years ?? "-"}</td>
                  <td>{o.confidence}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
