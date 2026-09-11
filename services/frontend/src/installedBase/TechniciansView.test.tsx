import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TechniciansView from "./TechniciansView";

function mockAnalytics() {
  return {
    total_observations: 0,
    by_modality: {},
    by_country: {},
    by_status: {},
    by_technician: {},
    by_technician_country: {},
    aging_customers: [],
    incomplete_customers: [],
    stale_customers: [],
    refresh_opportunities: [],
  };
}

describe("TechniciansView", () => {
  it("lists existing technicians, their last-seen status and record count", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/analytics")) return { ok: true, json: async () => mockAnalytics() };
        return {
          ok: true,
          json: async () => [
            {
              technician_id: "tech-01",
              name: "Field User 01",
              created_at: new Date().toISOString(),
              last_seen_at: null,
              last_extract_at: null,
              remote_extraction_count: 0,
              observation_count: 7,
            },
          ],
        };
      })
    );

    render(<TechniciansView />);

    expect(await screen.findByText("Field User 01")).toBeInTheDocument();
    expect(screen.getByText("Nunca conectado")).toBeInTheDocument();
    expect(screen.getByText("7 registros")).toBeInTheDocument();
  });

  it("shows a delegation count badge when a technician has offloaded inference to this node", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/analytics")) return { ok: true, json: async () => mockAnalytics() };
        return {
          ok: true,
          json: async () => [
            {
              technician_id: "tech-01",
              name: "Field User 01",
              created_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              last_extract_at: new Date().toISOString(),
              remote_extraction_count: 3,
              observation_count: 0,
            },
          ],
        };
      })
    );

    render(<TechniciansView />);

    expect(await screen.findByText("3x nodo principal")).toBeInTheDocument();
    // Aggregate KPI at the top of the view sums it across all technicians.
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("has no way to register a technician -- this view is read-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/analytics")) return { ok: true, json: async () => mockAnalytics() };
        return { ok: true, json: async () => [] };
      })
    );

    render(<TechniciansView />);

    await screen.findByText("Técnicos (0)");
    expect(screen.queryByPlaceholderText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByText("Registrar")).not.toBeInTheDocument();
  });
});
