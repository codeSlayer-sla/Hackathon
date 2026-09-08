import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalyticsView from "./AnalyticsView";

describe("AnalyticsView", () => {
  it("renders the aggregated analytics returned by the API", async () => {
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
        }),
      })
    );
    render(<AnalyticsView />);
    expect(await screen.findByText(/Total de observaciones: 20/)).toBeInTheDocument();
    expect(screen.getByText("Hospital Old")).toBeInTheDocument();
    expect(screen.getByText("Ninguno")).toBeInTheDocument();
  });
});
