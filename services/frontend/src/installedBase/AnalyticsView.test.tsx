import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalyticsView from "./AnalyticsView";

describe("AnalyticsView", () => {
  it("renders the aggregated analytics returned by the API, including freshness and opportunities", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total_observations: 20,
          by_modality: { MR: 10 },
          by_country: { Panama: 3 },
          by_status: { reported: 12 },
          average_age_years: 6.5,
          aging_customers: ["Hospital Old"],
          incomplete_customers: [],
          stale_customers: ["Hospital Stale"],
          refresh_opportunities: [{ customer: "Hospital Old", reason: "2 equipos con 10.0 anios promedio en CT" }],
        }),
      })
    );
    render(<AnalyticsView />);
    expect(await screen.findByText(/Total de observaciones: 20/)).toBeInTheDocument();
    // "Hospital Old" appears twice on purpose: once in the aging-customers
    // list, once as the customer name inside the refresh-opportunities line.
    expect(screen.getAllByText("Hospital Old")).toHaveLength(2);
    expect(screen.getByText("Hospital Stale")).toBeInTheDocument();
    expect(screen.getByText(/2 equipos con 10.0 anios promedio en CT/)).toBeInTheDocument();
    expect(screen.getByText("Ninguno")).toBeInTheDocument(); // incomplete_customers is empty
  });
});
